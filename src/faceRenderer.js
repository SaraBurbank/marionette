/**
 * FaceRenderer.js
 * 
 * Procedurally draws a character face directly on Canvas, mapped to the Head bone.
 * 
 * USE THIS for two purposes:
 *   1. Testing the expression system before your sprite sheet art is ready
 *   2. As a fallback / debug view alongside CharacterRenderer
 * 
 * The face features (eyes, brows, mouth) each react to two continuous signals:
 *   - velocityT (0–1): how fast the character is moving this frame
 *   - stretchT  (0–1): how extended the limb chains are
 * 
 * These signals drive smooth lerp-based deformation — no discrete state machine,
 * no snapping. The face is always alive.
 * 
 * USAGE:
 *   const face = new FaceRenderer(skeleton);
 * 
 *   // In your afterRender / loop, after skeleton.update():
 *   face.update();   // call once per frame to track velocity
 *   face.draw(ctx);  // call once per frame to render
 * 
 *   // Optional tuning:
 *   face.MAX_VELOCITY   = 20;   // px/frame considered "full speed"
 *   face.VELOCITY_DECAY = 0.88; // smoothing factor (0=instant, 1=never changes)
 *   face.palette = { skin: '#FFD580', ... };
 */

export class FaceRenderer {
    /**
     * @param {object} skeleton - Your Skeleton instance
     * @param {object} [options]
     * @param {object} [options.palette]       - Color overrides (see defaults below)
     * @param {number} [options.maxVelocity]   - px/frame at full expression activation
     * @param {number} [options.velocityDecay] - EMA smoothing factor
     */
    constructor(skeleton, options = {}) {
        this.skeleton = skeleton;

        // ── Expression signal state ──────────────────────────────────────────────
        this._prevHeadPos   = null;
        this._smoothVel     = 0;    // exponentially smoothed velocity magnitude
        this._stretchRatio  = 0;    // 0 = coiled, 1 = fully extended

        // ── Tuning ───────────────────────────────────────────────────────────────
        this.MAX_VELOCITY   = options.maxVelocity   ?? 18;   // px/frame
        this.VELOCITY_DECAY = options.velocityDecay ?? 0.85; // EMA factor

        // ── Palette ──────────────────────────────────────────────────────────────
        this.palette = {
            skin:       '#FFD580',
            skinShadow: '#E8B84B',
            eyeWhite:   '#FFFCF2',
            eyeIris:    '#2D3A5E',
            eyePupil:   '#0D1117',
            brow:       '#4A3020',
            mouth:      '#C0634A',
            mouthLine:  '#8B3A2A',
            ...options.palette,
        };
    }

    // ─── Public API ──────────────────────────────────────────────────────────────

    /**
     * Updates velocity and stretch tracking.
     * Call once per frame, before draw().
     */
    update() {
        this._updateVelocity();
        this._updateStretch();
    }

    /**
     * Draws the procedural face centered on the Head bone's tip.
     * Call once per frame, after update().
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        const head = this._getBone('Head');
        if (!head) return;

        // Normalized signals, both 0–1
        const velocityT = Math.min(this._smoothVel / this.MAX_VELOCITY, 1);
        const stretchT  = this._stretchRatio;

        // Face center = Head bone tail
        const cx = head.tailX;
        const cy = head.tailY;
        const r  = head.length * 0.45;  // face radius scales with head bone length

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(head.worldAngle);    // face rotates with the head bone

        this._drawFaceBase(ctx, r);
        this._drawEyes(ctx, r, velocityT, stretchT);
        this._drawBrows(ctx, r, velocityT, stretchT);
        this._drawMouth(ctx, r, velocityT, stretchT);

        ctx.restore();
    }

    // ─── Signal tracking ─────────────────────────────────────────────────────────

    _updateVelocity() {
        const head = this._getBone('Head');
        if (!head) return;

        if (this._prevHeadPos) {
            const raw = Math.hypot(
                head.worldX - this._prevHeadPos.x,
                head.worldY - this._prevHeadPos.y
            );
            // Exponential moving average: blends toward new value each frame
            this._smoothVel = this._smoothVel * this.VELOCITY_DECAY + raw * (1 - this.VELOCITY_DECAY);
        }
        this._prevHeadPos = { x: head.worldX, y: head.worldY };
    }

    _updateStretch() {
        const chains = [
            { tip: 'R_Hand', root: 'R_Shoulder' },
            { tip: 'L_Hand', root: 'L_Shoulder' },
            { tip: 'R_Foot', root: 'R_Hip'      },
            { tip: 'L_Foot', root: 'L_Hip'      },
        ];

        let total = 0, count = 0;

        for (const { tip, root } of chains) {
            const tipBone  = this._getBone(tip);
            const rootBone = this._getBone(root);
            if (!tipBone || !rootBone) continue;

            try {
                const chain  = this.skeleton.getChain(tip, root);
                const length = chain.reduce((sum, b) => sum + b.length, 0);
                if (length === 0) continue;

                const dist = Math.hypot(
                    tipBone.tailX - rootBone.worldX,
                    tipBone.tailY - rootBone.worldY
                );
                total += Math.min(dist / length, 1);
                count++;
            } catch { /* chain lookup failed, skip */ }
        }

        this._stretchRatio = count > 0 ? total / count : 0;
    }

    // ─── Face base ───────────────────────────────────────────────────────────────

    _drawFaceBase(ctx, r) {
        // Subtle squash/stretch on the face itself based on velocity
        // Fast movement = slightly taller face (excitement stretches upward)
        const velocityT = Math.min(this._smoothVel / this.MAX_VELOCITY, 1);
        const scaleY = 1 + velocityT * 0.08;
        const scaleX = 1 - velocityT * 0.04;

        ctx.save();
        ctx.scale(scaleX, scaleY);

        // Shadow / depth
        ctx.beginPath();
        ctx.ellipse(r * 0.05, r * 0.05, r, r * 0.98, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.palette.skinShadow;
        ctx.fill();

        // Main face
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.98, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.palette.skin;
        ctx.fill();

        ctx.restore();
    }

    // ─── Eyes ────────────────────────────────────────────────────────────────────

    /**
     * Eyes widen with velocity, squint/narrow under strain (high stretch).
     * The two signals work against each other: fast motion = wide open,
     * near-full-extension = squinted concentration.
     */
    _drawEyes(ctx, r, velocityT, stretchT) {
        const eyeOffsetX = r * 0.32;
        const eyeOffsetY = r * -0.08;

        // Eye height: widens with velocity, narrows with stretch
        // Base = 0.22r, wide = 0.34r, squint = 0.10r
        const heightMultiplier = lerp(
            lerp(0.22, 0.34, velocityT),    // velocity drives open
            0.10,                            // stretch drives squint
            stretchT * 0.7                   // stretch only partially overrides
        );
        const eyeH = r * heightMultiplier;
        const eyeW = r * 0.20;

        for (const side of [-1, 1]) {
            const ex = eyeOffsetX * side;
            const ey = eyeOffsetY;

            // White
            ctx.beginPath();
            ctx.ellipse(ex, ey, eyeW, eyeH, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.palette.eyeWhite;
            ctx.fill();

            // Iris — shifts slightly in direction of movement
            const irisR = eyeW * 0.65;
            const irisOffY = lerp(0, eyeH * 0.1, velocityT); // eyes look "up" slightly when excited
            ctx.beginPath();
            ctx.ellipse(ex, ey + irisOffY, irisR, Math.min(irisR, eyeH * 0.9), 0, 0, Math.PI * 2);
            ctx.fillStyle = this.palette.eyeIris;
            ctx.fill();

            // Pupil
            const pupilR = irisR * 0.55;
            ctx.beginPath();
            ctx.arc(ex, ey + irisOffY, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = this.palette.eyePupil;
            ctx.fill();

            // Highlight
            ctx.beginPath();
            ctx.arc(ex - irisR * 0.25, ey + irisOffY - irisR * 0.25, pupilR * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fill();

            // Upper eyelid shadow line (thickens when squinting)
            const lidThickness = lerp(1.5, 3.5, stretchT);
            ctx.beginPath();
            ctx.ellipse(ex, ey - eyeH * 0.1, eyeW * 0.95, eyeH * 0.85, 0, Math.PI, Math.PI * 2);
            ctx.strokeStyle = this.palette.skinShadow;
            ctx.lineWidth = lidThickness;
            ctx.stroke();
        }
    }

    // ─── Brows ───────────────────────────────────────────────────────────────────

    /**
     * Brows raise with velocity (surprise/excitement),
     * furrow inward + down with stretch (effort/strain).
     * Both can activate simultaneously for a "determined" look at high speed + full extension.
     */
    _drawBrows(ctx, r, velocityT, stretchT) {
        const browOffsetX = r * 0.30;
        const browBaseY   = r * -0.32;

        // Vertical offset: up with velocity, down with stretch
        const browRaise  = velocityT * r * 0.10;
        const browFurrow = stretchT  * r * 0.06;
        const browY      = browBaseY - browRaise + browFurrow;

        // Inward rotation: increases with stretch (brows angle down toward center)
        const furrowAngle = stretchT * 0.35; // radians

        ctx.lineWidth = r * 0.07;
        ctx.lineCap = 'round';
        ctx.strokeStyle = this.palette.brow;

        for (const side of [-1, 1]) {
            const bx = browOffsetX * side;

            // Brow is a short arc; its inner end dips on furrow
            const innerX = bx - side * r * 0.22;
            const innerY = browY + stretchT * r * 0.08;  // inner end dips
            const outerX = bx + side * r * 0.10;
            const outerY = browY - velocityT * r * 0.04; // outer end lifts on velocity

            ctx.beginPath();
            ctx.moveTo(innerX, innerY);
            ctx.quadraticCurveTo(bx, browY - r * 0.02, outerX, outerY);
            ctx.stroke();
        }
    }

    // ─── Mouth ───────────────────────────────────────────────────────────────────

    /**
     * Mouth opens slightly with high velocity (excited/gasping),
     * pulls into a tense line under stretch (effort).
     * At rest it's a gentle, neutral curve.
     */
    _drawMouth(ctx, r, velocityT, stretchT) {
        const mouthY    = r * 0.30;
        const mouthW    = r * 0.38;

        // Mouth open height: 0 at rest/strain, increases with velocity
        // Strain suppresses the open (clenched jaw)
        const openH = r * lerp(0, 0.18, velocityT) * (1 - stretchT * 0.8);

        // Smile curve depth: slight smile at rest, flattens under strain
        const curveDepth = lerp(r * 0.06, 0, stretchT);

        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';

        if (openH > r * 0.03) {
            // Open mouth: filled ellipse-ish shape
            ctx.beginPath();
            ctx.ellipse(0, mouthY + openH * 0.3, mouthW * 0.7, openH, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.palette.mouth;
            ctx.fill();
        }

        // Mouth line / smile curve
        ctx.beginPath();
        ctx.moveTo(-mouthW, mouthY);
        ctx.quadraticCurveTo(0, mouthY + curveDepth, mouthW, mouthY);
        ctx.strokeStyle = this.palette.mouthLine;
        ctx.lineWidth   = r * 0.055;
        ctx.stroke();

        // Tense mouth: additional tight line overlaid under high stretch
        if (stretchT > 0.4) {
            const tensionAlpha = (stretchT - 0.4) / 0.6;
            ctx.beginPath();
            ctx.moveTo(-mouthW * 0.7, mouthY);
            ctx.lineTo( mouthW * 0.7, mouthY);
            ctx.strokeStyle = `rgba(${hexToRgb(this.palette.mouthLine)}, ${tensionAlpha * 0.6})`;
            ctx.lineWidth   = r * 0.04;
            ctx.stroke();
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    _getBone(name) {
        try   { return this.skeleton.getBone(name); }
        catch { return null; }
    }
}

// ── Module-level utilities ───────────────────────────────────────────────────

/**
 * Linear interpolation.
 * @param {number} a - start value
 * @param {number} b - end value
 * @param {number} t - 0 to 1
 */
function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Converts a CSS hex color string to "r, g, b" for use in rgba().
 * @param {string} hex - e.g. "#C0634A"
 * @returns {string} e.g. "192, 99, 74"
 */
function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}