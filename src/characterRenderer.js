/** Draws the default Marionette character procedurally on Canvas,
 *  mapped to the live skeleton bone positions.
 */
export class CharacterRenderer {
    constructor(skeleton) {
        this.skeleton = skeleton;

        // palette
        this.c = {
            skin:      '#E8C98A',   // tan
            skinDark:  '#C9A96A',   // shading
            torso:     '#3D2008',   // dark brown torso block
            torsoDark: '#2A1205',
            hip:       '#5C3010',   // slightly lighter brown shorts
            hipDark:   '#3D2008',
            boot:      '#2A1205',   // very dark brown feet
            bootDark:  '#1A0B02',
            bootLight: '#4A2010',
            eyeFill:   '#1A0808',   // dark eye dots
            mouthLine: '#1A0808',
            outline:   'rgba(30,15,5,0.45)',
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

        // DRAW ORDER — back to front: Hair, Left leg, Left arm, Right leg, Right arm, Torso, Head / face
        // this._drawHair(ctx, velocityT);
        this._drawLeg(ctx, 'L_UpperLeg', 'L_Shin', 'L_Foot', true);
        this._drawTorso(ctx);
        this._drawArm(ctx, 'L_UpperArm', 'L_Forearm', 'L_Hand', true);
        this._drawLeg(ctx, 'R_UpperLeg', 'R_Shin', 'R_Foot', false);
        this._drawArm(ctx, 'R_UpperArm', 'R_Forearm', 'R_Hand', false);
        this._drawHead(ctx, velocityT, stretchT);

        if (this.debug) this.skeleton.drawBones(ctx);

        ctx.restore();
    }
    // body parts
    _drawTorso(ctx) {
        const chest = this._bone('Chest');
        const spine = this._bone('Spine');
        const hip   = this._bone('Hip');
        if (!chest || !spine || !hip) return;

        // ── Chest block ──
        // Width derived from shoulder spread
        const rShoulder = this._bone('R_Shoulder');
        const lShoulder = this._bone('L_Shoulder');
        const chestW = rShoulder && lShoulder
            ? Math.hypot(
                rShoulder.worldX - lShoulder.worldX,
                rShoulder.worldY - lShoulder.worldY
              ) * 0.82
            : chest.length * 1.1
        ;
        
        // Draw chest + spine as one tall block
        const topX = chest.worldX;
        const topY = chest.worldY;
        const botX = spine.tailX;
        const botY = spine.tailY;

        ctx.save();
        ctx.translate(topX, topY);
        ctx.rotate(chest.worldAngle);
 
        const totalH = chest.length + spine.length;
        ctx.beginPath();
        ctx.roundRect(-chestW / 2, 0, chestW, totalH, [4, 4, 2, 2]);
        ctx.fillStyle   = this.c.torso;
        ctx.fill();
        ctx.strokeStyle = this.c.outline;
        ctx.lineWidth   = 1;
        ctx.stroke();
        ctx.restore();
 
        // ── Hip / shorts block ──
        const hipW = chestW * 0.88;
        ctx.save();
        ctx.translate(hip.worldX, hip.worldY);
        ctx.rotate(hip.worldAngle);
        ctx.beginPath();
        ctx.roundRect(-hipW / 2, 0, hipW, hip.length * 1.4, [0, 0, 4, 4]);
        ctx.fillStyle   = this.c.hip;
        ctx.fill();
        ctx.strokeStyle = this.c.outline;
        ctx.lineWidth   = 1;
        ctx.stroke();
        ctx.restore();
    }
    _drawArm(ctx, upperName, forearmName, handName, isLeft) {
        const upper   = this._bone(upperName);
        const forearm = this._bone(forearmName);
        const hand    = this._bone(handName);
        if (!upper || !forearm || !hand) return;

        this._drawLimb(ctx, upper,   upper.length   * 0.36, this.c.skin,  this.c.skinDark);
        this._drawLimb(ctx, forearm, forearm.length * 0.30, this.c.skin,  this.c.skinDark);
        this._drawHand(ctx, hand);

        ctx.globalAlpha = 1.0;
    }
    _drawHand(ctx, hand) {
        // Ellipse at the hand bone tip — matches the rounded nubs in the screenshot
        const cx = hand.tailX;
        const cy = hand.tailY;
        const r  = hand.length * 0.55;
 
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(hand.worldAngle);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.2, r * 0.7, r, 0, 0, Math.PI * 2);
        ctx.fillStyle   = this.c.skin;
        ctx.fill();
        ctx.strokeStyle = this.c.outline;
        ctx.lineWidth   = 0.8;
        ctx.stroke();
        ctx.restore();
    }
    _drawLeg(ctx, upperName, shinName, footName, isLeft) {
        const upper = this._bone(upperName);
        const shin  = this._bone(shinName);
        const foot  = this._bone(footName);
        if (!upper || !shin || !foot) return;

        this._drawLimb(ctx, upper, upper.length * 0.34, this.c.skin, this.c.skinDark);
        this._drawLimb(ctx, shin,  shin.length  * 0.30, this.c.boot, this.c.bootDark);
        this._drawFoot(ctx, foot, isLeft);

        ctx.globalAlpha = 1.0;
    }
    _drawFoot(ctx, foot, isLeft) {
        ctx.save();
        ctx.translate(foot.worldX, foot.worldY);
        ctx.rotate(foot.worldAngle);
 
        // Ankle connector
        this._drawLimb(ctx, foot, foot.length * 0.28, this.c.skin, this.c.skinDark);
 
        // Boot sole — flat rounded rectangle extending forward
        const bw = foot.length * 1.2;
        const bh = foot.length * 0.45;
        ctx.beginPath();
        ctx.roundRect(-foot.length * 0.18, foot.length * 0.55, bw, bh, 4);
        ctx.fillStyle   = this.c.boot;
        ctx.fill();
        ctx.strokeStyle = this.c.bootDark;
        ctx.lineWidth   = 0.8;
        ctx.stroke();
 
        ctx.restore();
    }
    _drawHead(ctx, velocityT, stretchT) {
        const neck = this._bone('Neck');
        const head = this._bone('Head');
        if (!neck || !head) return;

        const cx = head.tailX;
        const cy = head.tailY;
        const r  = head.length * 0.60;

        if (neck) {
            this._drawLimb(ctx, neck, neck.length * 0.28, this.c.skin, this.c.skinDark);
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(head.worldAngle);

        // Slight squash/stretch with velocity
        ctx.scale( 1 - velocityT * 0.03, 1 + velocityT * 0.04);

        // Head circle — flat fill matching screenshot
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle   = this.c.skin;
        ctx.fill();
        ctx.strokeStyle = this.c.outline;
        ctx.lineWidth   = 1.2;
        ctx.stroke();
 
        // Face 
        // Eyes — widen slightly with velocity, narrow with stretch
        const eyeOpenness = lerp(lerp(0.75, 1.0, velocityT), 0.4,stretchT * 0.6);
        const eyeY = -r * 0.15;
        const eyeX =  r * 0.27;
        const eyeR =  r * 0.10 * eyeOpenness;
 
        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(eyeX * side, eyeY, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = this.c.eyeFill;
            ctx.fill();
        }
 
        // Mouth — straight line at rest, slight curve with emotion
        const mouthY  = r * 0.22;
        const mouthW  = r * 0.32;
        const curveAmt = lerp(0, r * 0.06, velocityT) * (1 -stretchT);  // small smile when moving
 
        ctx.beginPath();
        ctx.moveTo(-mouthW, mouthY);
        ctx.quadraticCurveTo(0, mouthY + curveAmt, mouthW, mouthY);
        ctx.strokeStyle = this.c.mouthLine;
        ctx.lineWidth   = r * 0.06;
        ctx.lineCap     = 'round';
        ctx.stroke();
 
        ctx.restore();
    }
    // limb primitive - Draws a rounded pill shape along a bone
    _drawLimb(ctx, bone, halfWidth, fillColor, shadeColor) {
        if (bone.length === 0) return;

        // direction vector along bone (head to tail)
        const dx = bone.tailX - bone.worldX;
        const dy = bone.tailY - bone.worldY;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len; // unit vector along bone
        const uy = dy / len;
        const px = -uy;
        const py = ux;

        const x0 = bone.worldX;
        const y0 = bone.worldY;
        const x1 = bone.tailX;
        const y1 = bone.tailY;

        const boneAngle = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.moveTo(x0 - px * halfWidth, y0 - py * halfWidth);
        ctx.lineTo(x1 - px * halfWidth, y1 - py * halfWidth);
        ctx.arc(x1, y1, halfWidth, boneAngle + Math.PI, boneAngle, true);
        ctx.lineTo(x0 + px * halfWidth, y0 + py * halfWidth);
        ctx.arc(x0, y0, halfWidth, boneAngle, boneAngle + Math.PI, true);
        ctx.closePath();

        // Flat fill
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = this.c.outline;
        ctx.lineWidth = 0.8;
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