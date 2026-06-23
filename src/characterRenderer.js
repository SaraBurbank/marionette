/**
 * CharacterRenderer.js
 *
 * Draws the default Marionette character procedurally on Canvas,
 * mapped to the live skeleton bone positions.
 *
 * No sprite sheet required. Every body part is drawn using Canvas 2D
 * primitives (paths, arcs, bezier curves) transformed to match each
 * bone's world position and angle.
 */
export class CharacterRenderer {
    constructor(skeleton) {
        this.skeleton = skeleton;

        // palette
        this.c = {
            skin:        '#F5C9A0',
            skinDark:    '#E8A87C',
            skinShade:   '#D4956A',
            hair:        '#D4A017',
            hairDark:    '#B8860B',
            hairLight:   '#F0C040',
            outfit:      '#E8920A',
            outfitDark:  '#C47808',
            outfitLight: '#F5A830',
            boot:        '#3D2010',
            bootDark:    '#2A1508',
            bootLight:   '#5A3020',
            glove:       '#F8F0E0',
            gloveDark:   '#E0D8C8',
            eyeWhite:    '#FFF8F8',
            eyeIris:     '#E87090',
            eyePupil:    '#1A0808',
            eyeLash:     '#2A1010',
            brow:        '#8B6914',
            mouthLip:    '#D4607A',
            mouthDark:   '#A84060',
            cheek:       'rgba(240,150,160,0.25)',
            outline:     'rgba(60,30,10,0.5)',
            outlineHard: 'rgba(60,30,10,0.8)',
        };
        this._prevHeadPos   = null;
        this._smoothVel     = 0;
        this._stretchRatio  = 0;
        this.MAX_VELOCITY   = 18;
        this.VELOCITY_DECAY = 0.85;
    }
    update() {
        this._updateVelocity();
        this._updateStretch();
    }
    draw(ctx) {
        const velocityT = Math.min(this._smoothVel / this.MAX_VELOCITY, 1);
        const stretchT  = this._stretchRatio;

        ctx.save();
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';
        /**
         * DRAW ORDER — back to front:
         *
         *  1. Hair
         *  2. Left leg      
         *  3. Left arm      
         *  4. Right leg     
         *  5. Right arm     
         *  6. Torso         (chest + shorts + sash)
         *  7. Head / face   (on top of everything)
         *
         * Left-side limbs are drawn at slightly reduced opacity (0.82)
         * to suggest depth without a full shadow pass.
        */
        this._drawHair(ctx, velocityT);
        this._drawLeg(ctx, 'L_UpperLeg', 'L_Shin', 'L_Foot', true);
        this._drawArm(ctx, 'L_UpperArm', 'L_Forearm', 'L_Hand', true);
        this._drawLeg(ctx, 'R_UpperLeg', 'R_Shin', 'R_Foot', false);
        this._drawArm(ctx, 'R_UpperArm', 'R_Forearm', 'R_Hand', false);
        this._drawTorso(ctx);
        this._drawHead(ctx, velocityT, stretchT);

        if (this.debug) this.skeleton.drawBones(ctx);

        ctx.restore();
    }
    // body parts
    _drawTorso(ctx) {
        const chest = this._bone('Chest');
        const hip   = this._bone('Hip');
        if (!chest || !hip) return;

        const cx = chest.worldX;
        const cy = chest.worldY;
        const hx = hip.tailX;
        const hy = hip.tailY;

        // Perpendicular direction to the chest bone for width
        const angle = chest.worldAngle;
        const tw    = chest.length * 0.85;
        const perpX =  Math.cos(angle) * tw * 0.5;
        const perpY = -Math.sin(angle) * tw * 0.5;

        const chestL = { x: cx - perpX, y: cy - perpY };
        const chestR = { x: cx + perpX, y: cy + perpY };
        const hipL   = { x: hx.x - perpX * 0.7,  y: hy.y - perpY * 0.7 };
        const hipR   = { x: hx.x + perpX * 0.7,  y: hy.y + perpY * 0.7 };

        // Main torso fill
        ctx.beginPath();
        ctx.moveTo(chestL.x, chestL.y);
        ctx.bezierCurveTo(
            chestL.x - perpX * 0.1, chestL.y + (hy - cy) * 0.3,
            hipL.x,                  hipL.y   - (hy - cy) * 0.2,
            hipL.x,                  hipL.y
        );
        ctx.lineTo(hipR.x, hipR.y);
        ctx.bezierCurveTo(
            hipR.x,                  hipR.y   - (hy - cy) * 0.2,
            chestR.x + perpX * 0.1,  chestR.y + (hy - cy) * 0.3,
            chestR.x,                chestR.y
        );
        ctx.closePath();

        const torsoGrad = ctx.createLinearGradient(chestL.x, cy, chestR.x, cy);
        torsoGrad.addColorStop(0,   this.c.outfitDark);
        torsoGrad.addColorStop(0.4, this.c.outfit);
        torsoGrad.addColorStop(1,   this.c.outfitDark);
        ctx.fillStyle = torsoGrad;
        ctx.fill();
        ctx.strokeStyle = this.c.outline;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Shorts / hip area block
        const shortH = hip.length * 1.1;
        const shortW = tw * 1.2;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(hip.worldAngle);
        ctx.beginPath();
        ctx.roundRect(-shortW * 0.5, -shortH * 0.1, shortW, shortH, [0, 0, 8, 8]);
        ctx.fillStyle = this.c.outfitDark;
        ctx.fill();
        ctx.strokeStyle = this.c.outline;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
    }
    _drawArm(ctx, upperName, forearmName, handName, isLeft) {
        const upper   = this._bone(upperName);
        const forearm = this._bone(forearmName);
        const hand    = this._bone(handName);
        if (!upper || !forearm || !hand) return;

        ctx.globalAlpha = isLeft ? 0.82 : 1.0;

        this._drawLimb(ctx, upper,   upper.length   * 0.38, this.c.skin,  this.c.skinDark);
        this._drawLimb(ctx, forearm, forearm.length * 0.32, this.c.skin,  this.c.skinDark);

        // Cuff ellipse at wrist
        ctx.save();
        ctx.translate(forearm.tailX, forearm.tailY);
        ctx.rotate(forearm.worldAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, hand.length * 0.38, hand.length * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle   = this.c.glove;
        ctx.fill();
        ctx.strokeStyle = this.c.gloveDark;
        ctx.lineWidth   = 1;
        ctx.stroke();
        ctx.restore();

        this._drawLimb(ctx, hand, hand.length * 0.35, this.c.glove, this.c.gloveDark);

        // Rounded fingertip nub
        ctx.beginPath();
        ctx.arc(hand.tailX, hand.tailY, hand.length * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = this.c.glove;
        ctx.fill();

        ctx.globalAlpha = 1.0;
    }
    _drawLeg(ctx, upperName, shinName, footName, isLeft) {
        const upper = this._bone(upperName);
        const shin  = this._bone(shinName);
        const foot  = this._bone(footName);
        if (!upper || !shin || !foot) return;

        ctx.globalAlpha = isLeft ? 0.80 : 1.0;

        this._drawLimb(ctx, upper, upper.length * 0.40, this.c.skin, this.c.skinDark);
        this._drawLimb(ctx, shin,  shin.length  * 0.36, this.c.boot, this.c.bootDark);

        // Boot top cuff at knee
        ctx.save();
        ctx.translate(shin.worldX, shin.worldY);
        ctx.rotate(shin.worldAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, shin.length * 0.38, shin.length * 0.14, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.c.bootLight;
        ctx.fill();
        ctx.restore();

        // Foot / boot body
        ctx.save();
        ctx.translate(foot.worldX, foot.worldY);
        ctx.rotate(foot.worldAngle);
        ctx.beginPath();
        ctx.roundRect(
            -foot.length * 0.22, -foot.length * 0.15,
             foot.length * 0.95,  foot.length * 0.42,
            5
        );
        ctx.fillStyle   = this.c.boot;
        ctx.fill();
        ctx.strokeStyle = this.c.bootDark;
        ctx.lineWidth   = 1.2;
        ctx.stroke();

        // Toe highlight
        ctx.beginPath();
        ctx.ellipse(foot.length * 0.55, 0, foot.length * 0.22, foot.length * 0.12, 0, 0, Math.PI * 2);
        ctx.fillStyle   = this.c.bootLight;
        ctx.globalAlpha = isLeft ? 0.35 : 0.45;
        ctx.fill();

        ctx.restore();
        ctx.globalAlpha = 1.0;
    }
    _drawHead(ctx, velocityT, stretchT) {
        const neck = this._bone('Neck');
        const head = this._bone('Head');
        if (!neck || !head) return;

        const cx = head.tailX;
        const cy = head.tailY;
        const r  = head.length * 0.52;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(head.worldAngle);

        // Neck stub
        ctx.beginPath();
        ctx.ellipse(0, neck.length * 0.3, neck.length * 0.32, neck.length * 0.7 * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.c.skin;
        ctx.fill();

        // Head — slight vertical stretch with velocity
        ctx.save();
        ctx.scale(1, 1 + velocityT * 0.05);

        // Drop shadow
        ctx.beginPath();
        ctx.ellipse(r * 0.04, r * 0.04, r, r * 0.96, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.c.skinDark;
        ctx.fill();

        // Face
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.96, 0, 0, Math.PI * 2);
        const faceGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
        faceGrad.addColorStop(0,   this.c.glove);
        faceGrad.addColorStop(0.4, this.c.skin);
        faceGrad.addColorStop(1,   this.c.skinDark);
        ctx.fillStyle = faceGrad;
        ctx.fill();
        ctx.strokeStyle = this.c.outline;
        ctx.lineWidth   = 1.2;
        ctx.stroke();
        ctx.restore();

        // Cheek blushes
        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(r * 0.42 * side, r * 0.12, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.c.cheek;
            ctx.fill();
        }

        // Face features
        this._drawEyes(ctx, r, velocityT, stretchT);
        this._drawBrows(ctx, r, velocityT, stretchT);
        this._drawNose(ctx, r);
        this._drawMouth(ctx, r, velocityT, stretchT);

        ctx.restore();
    }
    _drawHair(ctx, velocityT) {
        const head = this._bone('Head');
        if (!head) return;

        const cx = head.tailX;
        const cy = head.tailY;
        const r  = head.length * 0.52;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(head.worldAngle);

        // Back hair mass (drawn first — behind face)
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, r * 1.15, r * 1.25, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.c.hairDark;
        ctx.fill();

        // Main curl blobs — spread slightly outward with velocity
        const spread = 1 + velocityT * 0.08;
        const blobs = [
            { x: -r * 0.85, y: -r * 0.50, rx: r * 0.42, ry: r * 0.38 },
            { x:  r * 0.85, y: -r * 0.50, rx: r * 0.42, ry: r * 0.38 },
            { x: -r * 0.55, y: -r * 0.95, rx: r * 0.38, ry: r * 0.32 },
            { x:  r * 0.55, y: -r * 0.95, rx: r * 0.38, ry: r * 0.32 },
            { x:  0,         y: -r * 1.10, rx: r * 0.40, ry: r * 0.35 },
            { x: -r * 1.00, y: -r * 0.10, rx: r * 0.32, ry: r * 0.38 },
            { x:  r * 1.00, y: -r * 0.10, rx: r * 0.32, ry: r * 0.38 },
            { x: -r * 0.30, y: -r * 1.20, rx: r * 0.30, ry: r * 0.28 },
            { x:  r * 0.30, y: -r * 1.20, rx: r * 0.30, ry: r * 0.28 },
        ];

        for (const b of blobs) {
            ctx.beginPath();
            ctx.ellipse(b.x * spread, b.y * spread, b.rx, b.ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.c.hair;
            ctx.fill();
        }

        // Highlight blobs
        const highlights = [
            { x: -r * 0.60, y: -r * 0.80, rx: r * 0.18, ry: r * 0.14 },
            { x:  r * 0.60, y: -r * 0.80, rx: r * 0.18, ry: r * 0.14 },
            { x:  0,         y: -r * 1.05, rx: r * 0.20, ry: r * 0.15 },
        ];
        for (const h of highlights) {
            ctx.beginPath();
            ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.c.hairLight;
            ctx.fill();
        }

        // Braided crown band
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.55, r * 0.75, r * 0.18, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.c.hairDark;
        ctx.fill();

        // Braid texture — diagonal tick marks
        for (let i = -3; i <= 3; i++) {
            const bx = i * r * 0.22;
            ctx.beginPath();
            ctx.moveTo(bx - r * 0.06, -r * 0.62);
            ctx.lineTo(bx + r * 0.06, -r * 0.48);
            ctx.strokeStyle = this.c.hairLight;
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        }

        // Outer hair outline
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, r * 1.15, r * 1.25, 0, 0, Math.PI * 2);
        ctx.strokeStyle = this.c.hairDark;
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        ctx.restore();
    }
    // face features 
    _drawEyes(ctx, r, velocityT, stretchT) {
        const eyeX = r * 0.30;
        const eyeY = r * -0.08;
        const eyeW = r * 0.22;
        const eyeH = r * lerp(lerp(0.20, 0.30, velocityT), 0.10, stretchT * 0.7);

        for (const side of [-1, 1]) {
            const ex = eyeX * side;

            // White
            ctx.beginPath();
            ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
            ctx.fillStyle   = this.c.eyeWhite;
            ctx.fill();
            ctx.strokeStyle = this.c.eyeLash;
            ctx.lineWidth   = 0.8;
            ctx.stroke();

            // Iris
            const irisR = eyeW * 0.62;
            const irisY = eyeY + lerp(0, eyeH * 0.08, velocityT);
            ctx.beginPath();
            ctx.ellipse(ex, irisY, irisR, Math.min(irisR, eyeH * 0.88), 0, 0, Math.PI * 2);
            ctx.fillStyle = this.c.eyeIris;
            ctx.fill();

            // Pupil
            const pupilR = irisR * 0.52;
            ctx.beginPath();
            ctx.arc(ex, irisY, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = this.c.eyePupil;
            ctx.fill();

            // Catchlight
            ctx.beginPath();
            ctx.arc(ex - irisR * 0.28, irisY - irisR * 0.28, pupilR * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fill();

            // Upper lash arc
            ctx.beginPath();
            ctx.ellipse(ex, eyeY - eyeH * 0.08, eyeW * 0.95, eyeH * 0.82, 0, Math.PI, Math.PI * 2);
            ctx.strokeStyle = this.c.eyeLash;
            ctx.lineWidth   = lerp(1.8, 3.0, stretchT);
            ctx.stroke();

            // Lower lash line
            ctx.beginPath();
            ctx.ellipse(ex, eyeY + eyeH * 0.08, eyeW * 0.90, eyeH * 0.75, 0, 0, Math.PI);
            ctx.strokeStyle = this.c.eyeLash;
            ctx.lineWidth   = 0.6;
            ctx.stroke();
        }
    }
    _drawBrows(ctx, r, velocityT, stretchT) {
        const browBaseY  = r * -0.34;
        const browRaise  = velocityT * r * 0.09;
        const browFurrow = stretchT  * r * 0.06;
        const browY      = browBaseY - browRaise + browFurrow;

        ctx.lineWidth   = r * 0.065;
        ctx.lineCap     = 'round';
        ctx.strokeStyle = this.c.brow;

        for (const side of [-1, 1]) {
            const bx     = r * 0.30 * side;
            const innerX = bx - side * r * 0.20;
            const innerY = browY + stretchT * r * 0.07;
            const outerX = bx + side * r * 0.08;
            const outerY = browY - velocityT * r * 0.04;

            ctx.beginPath();
            ctx.moveTo(innerX, innerY);
            ctx.quadraticCurveTo(bx, browY - r * 0.02, outerX, outerY);
            ctx.stroke();
        }
    }
    _drawNose(ctx, r) {
        ctx.beginPath();
        ctx.ellipse(0, r * 0.12, r * 0.07, r * 0.05, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.c.skinShade;
        ctx.fill();
    }
    _drawMouth(ctx, r, velocityT, stretchT) {
        const mouthY = r * 0.30;
        const mouthW = r * 0.36;
        const openH  = r * lerp(0, 0.16, velocityT) * (1 - stretchT * 0.8);
        const curveD = lerp(r * 0.07, 0, stretchT);

        // Open mouth fill
        if (openH > r * 0.02) {
            ctx.beginPath();
            ctx.ellipse(0, mouthY + openH * 0.3, mouthW * 0.6, openH, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.c.mouthDark;
            ctx.fill();
        }

        // Upper lip
        ctx.beginPath();
        ctx.moveTo(-mouthW, mouthY);
        ctx.bezierCurveTo(
            -mouthW * 0.5, mouthY - r * 0.06,
             mouthW * 0.5, mouthY - r * 0.06,
             mouthW,       mouthY
        );
        ctx.strokeStyle = this.c.mouthLip;
        ctx.lineWidth   = r * 0.065;
        ctx.stroke();

        // Lower lip / smile
        ctx.beginPath();
        ctx.moveTo(-mouthW, mouthY);
        ctx.quadraticCurveTo(0, mouthY + curveD, mouthW, mouthY);
        ctx.strokeStyle = this.c.mouthDark;
        ctx.lineWidth   = r * 0.05;
        ctx.stroke();

        // Lip gloss highlight
        ctx.beginPath();
        ctx.ellipse(0, mouthY + curveD * 0.4, mouthW * 0.28, r * 0.028, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,220,220,0.4)';
        ctx.fill();
    }
    // limb primitive - Draws a rounded pill shape centered on bone axis with halfWidth on each side
    _drawLimb(ctx, bone, halfWidth, fillColor, shadeColor) {
        const angle  = bone.worldAngle;
        // Perpendicular direction (rotate angle by 90°)
        const perpX  =  Math.cos(angle) * halfWidth;
        const perpY  = -Math.sin(angle) * halfWidth;

        const x0 = bone.worldX;
        const y0 = bone.worldY;
        const x1 = bone.tailX;
        const y1 = bone.tailY;

        ctx.beginPath();
        ctx.moveTo(x0 - perpX, y0 - perpY);
        ctx.lineTo(x1 - perpX, y1 - perpY);
        ctx.arc(x1, y1, halfWidth, angle - Math.PI * 0.5, angle + Math.PI * 0.5);
        ctx.lineTo(x0 + perpX, y0 + perpY);
        ctx.arc(x0, y0, halfWidth, angle + Math.PI * 0.5, angle - Math.PI * 0.5);
        ctx.closePath();

        // Cross-limb gradient for cylindrical shading
        const grad = ctx.createLinearGradient(
            x0 - perpX, y0 - perpY,
            x0 + perpX, y0 + perpY
        );
        grad.addColorStop(0,    shadeColor);
        grad.addColorStop(0.35, fillColor);
        grad.addColorStop(0.65, fillColor);
        grad.addColorStop(1,    shadeColor);

        ctx.fillStyle   = grad;
        ctx.fill();
        ctx.strokeStyle = this.c.outline;
        ctx.lineWidth   = 1.0;
        ctx.stroke();
    }
    _updateVelocity() {
        const head = this._bone('Head');
        if (!head) return;
        if (this._prevHeadPos) {
            const raw = Math.hypot(
                head.worldX - this._prevHeadPos.x,
                head.worldY - this._prevHeadPos.y
            );
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
            const tipBone  = this._bone(tip);
            const rootBone = this._bone(root);
            if (!tipBone || !rootBone) continue;
            try {
                const chain  = this.skeleton.getChain(tip, root);
                const length = chain.reduce((s, b) => s + b.length, 0);
                if (!length) continue;
                const dist = Math.hypot(
                    tipBone.tailX  - rootBone.worldX,
                    tipBone.tailY  - rootBone.worldY
                );
                total += Math.min(dist / length, 1);
                count++;
            } catch { /* bone not found, skip */ }
        }
        this._stretchRatio = count > 0 ? total / count : 0;
    }
    _bone(name) {
        try   { return this.skeleton.getBone(name); }
        catch { return null; }
    }
}
function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
}