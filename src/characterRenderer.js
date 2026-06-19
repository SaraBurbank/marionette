/**
 * SPRITE SHEET LAYOUT EXPECTED:
 * 
 *   The sheet is divided into two columns:
 *     Column A (body parts) — left side, one row per bone part
 *     Column B (face strips) — right side, one row per feature × expression
 * 
 *   Recommended layout (all regions same height = CELL_H, width = CELL_W):
 * 
 *   Row  0 : Hip
 *   Row  1 : Spine
 *   Row  2 : Chest
 *   Row  3 : Neck
 *   Row  4 : Head (face base / silhouette)
 *   Row  5 : R_UpperArm
 *   Row  6 : R_Forearm
 *   Row  7 : R_Hand
 *   Row  8 : L_UpperArm
 *   Row  9 : L_Forearm
 *   Row 10 : L_Hand
 *   Row 11 : R_UpperLeg
 *   Row 12 : R_Shin
 *   Row 13 : R_Foot
 *   Row 14 : L_UpperLeg
 *   Row 15 : L_Shin
 *   Row 16 : L_Foot
 * 
 *   Face strip (Column B, same row height, each strip has N_EXPRESSIONS columns):
 *   Row  0 : Eyes     — col 0 neutral | col 1 wide | col 2 squint
 *   Row  1 : Brows    — col 0 neutral | col 1 raised | col 2 furrowed
 *   Row  2 : Mouth    — col 0 neutral | col 1 open | col 2 tense
 * 
 * USAGE:
 *   const renderer = new CharacterRenderer('./assets/character.png', skeleton);
 *   await renderer.load();
 * 
 *   // In your afterRender / loop:
 *   renderer.draw(ctx);
 * 
 *   // Toggle debug sticks on/off:
 *   renderer.debug = true;
 */

export class CharacterRenderer {
    /**
     * @param {string}   spriteSrc  - Path or URL to the sprite sheet image
     * @param {object}   skeleton   - Your Skeleton instance
     * @param {object}   [options]
     * @param {number}   [options.cellW=64]         - Pixel width of one sprite cell
     * @param {number}   [options.cellH=64]         - Pixel height of one sprite cell
     * @param {number}   [options.faceColOffset=18] - Column index where face strip starts (Column B)
     * @param {number}   [options.nExpressions=3]   - Number of expression columns per face feature
     * @param {number}   [options.drawOrder]        - Optional custom draw order (see DRAW_ORDER below)
     */
    constructor(spriteSrc, skeleton, options = {}) {
        this.spriteSrc     = spriteSrc;
        this.skeleton      = skeleton;
        this.image         = null;
        this.loaded        = false;
        this.debug         = false;   // set true to overlay skeleton sticks

        // Sprite sheet geometry
        this.cellW         = options.cellW         ?? 64;
        this.cellH         = options.cellH         ?? 64;
        this.faceColOffset = options.faceColOffset  ?? 18; // face strip starts at column 18
        this.nExpressions  = options.nExpressions   ?? 3;

        // Velocity tracking for expression signals
        this._prevPositions = {};   // { boneName: { x, y } }
        this._velocity      = 0;   // scalar: pixels/frame, smoothed
        this._stretch       = 0;   // 0–1, how extended the limbs are

        // Tuning constants — adjust to taste
        this.MAX_VELOCITY   = 18;   // px/frame at which expression is fully activated
        this.VELOCITY_DECAY = 0.85; // smoothing: lower = snappier, higher = lazier

        /**
         * DRAW ORDER
         * Back-to-front. Bones listed first are drawn underneath later ones.
         * Omit bones you don't have sprites for (they'll be skipped silently).
         * Shoulder/Hip bones are zero-length connectors — usually hidden, include
         * only if your sheet has sprites for them.
         */
        this.drawOrder = options.drawOrder ?? [
            // Back limbs first
            'L_UpperLeg', 'L_Shin', 'L_Foot',
            'L_UpperArm', 'L_Forearm', 'L_Hand',
            // Torso
            'Hip', 'Spine', 'Chest',
            // Front limbs
            'R_UpperLeg', 'R_Shin', 'R_Foot',
            'R_UpperArm', 'R_Forearm', 'R_Hand',
            // Head last (on top)
            'Neck', 'Head',
        ];

        /**
         * BONE → SPRITE ROW mapping.
         * Maps bone name to its row index in Column A of the sprite sheet.
         * Edit these numbers to match your actual sheet layout.
         */
        this.boneRow = {
            Hip:        0,
            Spine:      1,
            Chest:      2,
            Neck:       3,
            Head:       4,
            R_UpperArm: 5,
            R_Forearm:  6,
            R_Hand:     7,
            L_UpperArm: 8,
            L_Forearm:  9,
            L_Hand:     10,
            R_UpperLeg: 11,
            R_Shin:     12,
            R_Foot:     13,
            L_UpperLeg: 14,
            L_Shin:     15,
            L_Foot:     16,
        };
    }
    // Loading
    load() {
        return new Promise((resolve, reject) => {
            this.image = new Image();
            this.image.onload  = () => { this.loaded = true; resolve(); };
            this.image.onerror = () => reject(new Error(`CharacterRenderer: failed to load "${this.spriteSrc}"`));
            this.image.src = this.spriteSrc;
        });
    }
    // Main draw entry point
    draw(ctx) {
        if (!this.loaded) return;

        this._updateVelocity();
        const expressionState = this._computeExpressionState();

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        for (const boneName of this.drawOrder) {
            const row = this.boneRow[boneName];
            if (row === undefined) continue;             // not in sheet, skip

            const bone = this._getBone(boneName);
            if (!bone || bone.length === 0) continue;   // zero-length connector, skip

            this._drawBoneSprite(ctx, bone, row);
        }

        // Draw face composited on top of the Head bone
        this._drawFace(ctx, expressionState);

        if (this.debug) this.skeleton.drawBones(ctx);

        ctx.restore();
    }

    // Per-bone sprite drawing
    /**
     * Draws one body part sprite, stretched to match the bone's length,
     * rotated to match bone.worldAngle.
     */
    _drawBoneSprite(ctx, bone, row) {
        const { cellW, cellH } = this;

        // Source rect in sprite sheet (Column A = column 0)
        const sx = 0;
        const sy = row * cellH;
        const sw = cellW;
        const sh = cellH;

        // Destination size: width stays cellW, height stretches to bone.length
        // Sprites should be drawn pointing DOWN in the sheet (head at top of cell).
        const dw = cellW;
        const dh = bone.length;

        // Bone midpoint in world space
        const midX = bone.worldX + Math.sin(bone.worldAngle) * bone.length * 0.5;
        const midY = bone.worldY + Math.cos(bone.worldAngle) * bone.length * 0.5;

        ctx.save();
        ctx.translate(midX, midY);

        // Correct for angle convention: bone 0° points down, Canvas 0° points right
        ctx.rotate(bone.worldAngle - Math.PI / 2 + Math.PI / 2);
        // Simplified: bone.worldAngle IS already the canvas rotation we need
        // because our angle is measured from +Y clockwise, same as Canvas rotate
        // when offset by the draw direction. Net: just use bone.worldAngle.
        // (The two offsets cancel. Left here commented for clarity.)

        // Draw centered on midpoint: offset by -dw/2 horizontally, -dh/2 vertically
        ctx.drawImage(
            this.image,
            sx, sy, sw, sh,
            -dw / 2, -dh / 2, dw, dh
        );

        ctx.restore();
    }
    _drawFace(ctx, state) {
        const headBone = this._getBone('Head');
        if (!headBone) return;

        // Face center = head bone tail (tip of the head bone)
        const faceCX = headBone.tailX;
        const faceCY = headBone.tailY;

        // Face rotation matches head bone
        const faceAngle = headBone.worldAngle;

        // Expression column selection per feature:
        //   Eyes    — driven by velocity  (0 neutral, 1 wide, 2 squint-strained)
        //   Brows   — driven by stretch   (0 neutral, 1 raised-velocity, 2 furrowed-strain)
        //   Mouth   — blend of both       (0 neutral, 1 open, 2 tense)
        const eyeCol   = this._expressionColumn(state.velocity, 0.3, 0.75);
        const browCol  = this._expressionColumn(state.stretch,  0.25, 0.65);
        const mouthCol = this._expressionColumn(
            Math.max(state.velocity, state.stretch), 0.3, 0.7
        );

        const faceSize = headBone.length;  // face sprite scales with head bone length

        ctx.save();
        ctx.translate(faceCX, faceCY);
        ctx.rotate(faceAngle);

        // Draw each face layer (eyes=row 0, brows=row 1, mouth=row 2 in face strip)
        this._drawFaceFeature(ctx, 0, eyeCol,   faceSize);
        this._drawFaceFeature(ctx, 1, browCol,  faceSize);
        this._drawFaceFeature(ctx, 2, mouthCol, faceSize);

        ctx.restore();
    }
    _drawFaceFeature(ctx, featureRow, expressionCol, size) {
        const { cellW, cellH, faceColOffset, nExpressions } = this;

        // Source: face strip starts at faceColOffset columns into the sheet
        const sx = (faceColOffset + expressionCol) * cellW;
        const sy = featureRow * cellH;
        const sw = cellW;
        const sh = cellH;

        // Render centered on face origin
        ctx.drawImage(
            this.image,
            sx, sy, sw, sh,
            -size / 2, -size / 2, size, size
        );
    }

    // Expression state computation 
    _updateVelocity() {
        const head = this._getBone('Head');
        if (!head) return;

        const prev = this._prevPositions['Head'];
        if (prev) {
            const rawVel = Math.hypot(head.worldX - prev.x, head.worldY - prev.y);
            // Exponential moving average smoothing
            this._velocity = this._velocity * this.VELOCITY_DECAY + rawVel * (1 - this.VELOCITY_DECAY);
        }
        this._prevPositions['Head'] = { x: head.worldX, y: head.worldY };

        // Stretch: average of how extended the four limb chains are (0=coiled, 1=fully extended)
        this._stretch = this._computeStretchRatio();
    }
    _computeStretchRatio() {
        const chains = [
            { tip: 'R_Hand', root: 'R_Shoulder' },
            { tip: 'L_Hand', root: 'L_Shoulder' },
            { tip: 'R_Foot', root: 'R_Hip' },
            { tip: 'L_Foot', root: 'L_Hip' },
        ];

        let total = 0;
        let count = 0;

        for (const { tip, root } of chains) {
            const tipBone  = this._getBone(tip);
            const rootBone = this._getBone(root);
            if (!tipBone || !rootBone) continue;

            try {
                const chain = this.skeleton.getChain(tip, root);
                const chainLength = chain.reduce((sum, b) => sum + b.length, 0);
                if (chainLength === 0) continue;

                const dist = Math.hypot(
                    tipBone.tailX - rootBone.worldX,
                    tipBone.tailY - rootBone.worldY
                );
                total += Math.min(dist / chainLength, 1);
                count++;
            } catch {
                // chain lookup failed, skip
            }
        }

        return count > 0 ? total / count : 0;
    }
    _computeExpressionState() {
        return {
            velocity: Math.min(this._velocity / this.MAX_VELOCITY, 1),
            stretch:  this._stretch,
        };
    }
    _expressionColumn(signal, lowThreshold, highThreshold) {
        if (signal >= highThreshold) return 2;
        if (signal >= lowThreshold)  return 1;
        return 0;
    }
    _getBone(name) {
        try {
            return this.skeleton.getBone(name);
        } catch {
            return null;
        }
    }
}