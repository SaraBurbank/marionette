export class Marionette {
    constructor(ctx) {
        this.ctx = ctx
        this.skin = "#d7c29b";
        this.skinDark = "#b79c6d";
        this.outline = "#7a6744";
    }
    _joint(x, y, r) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fillStyle = this.skin;
        this.ctx.fill();
        this.ctx.strokeStyle = this.outline;
        this.ctx.stroke();
    }
    _capsule(length, width) {
        const r = width / 2;

        this.ctx.beginPath();
        this.ctx.moveTo(0, -r);
        this.ctx.lineTo(length, -r);
        this.ctx.arc(length, 0, r, -Math.PI/2, Math.PI/2);
        this.ctx.lineTo(0, r);
        this.ctx.arc(0, 0, r, Math.PI/2, -Math.PI/2);
        this.ctx.closePath();

        const g = this.ctx.createLinearGradient(0, -r, 0, r);
        g.addColorStop(0, this.skinDark);
        g.addColorStop(0.5, this.skin);
        g.addColorStop(1, this.skinDark);

        this.ctx.fillStyle = g;
        this.ctx.fill();
        this.ctx.strokeStyle = this.outline;
        this.ctx.stroke();
    }
    _limb(x, y, angle, length, width) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        this._capsule(length, width);

        this.ctx.restore();

        return {
            x: x + Math.cos(angle) * length,
            y: y + Math.sin(angle) * length
        };
    }
    drawDoll(x, y) {
        const torsoW = 80;
        const torsoH = 130;
        const headX = x;
        const headY = y - 220;

        this.ctx.save();
        this.ctx.translate(headX, headY);
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 40, 55, 0, 0, Math.PI * 2);

        const hg = this.ctx.createRadialGradient( -10, -20, 5, 0, 0, 60 );

        hg.addColorStop(0, "#e7d5af");
        hg.addColorStop(1, this.skinDark);

        this.ctx.fillStyle = hg;
        this.ctx.fill();
        this.ctx.strokeStyle = this.outline;
        this.ctx.stroke();

        this.ctx.restore();

        // NECK
        this._joint(x, y - 155, 10);

        // TORSO
        this.ctx.save();
        this.ctx.translate(x, y - 80);

        this.ctx.beginPath();
        this.ctx.roundRect(
            -torsoW / 2,
            -torsoH / 2,
            torsoW,
            torsoH,
            25
        );

        const tg = this.ctx.createLinearGradient( -40, 0, 40, 0 );

        tg.addColorStop(0, this.skinDark);
        tg.addColorStop(0.5, this.skin);
        tg.addColorStop(1, this.skinDark);

        this.ctx.fillStyle = tg;
        this.ctx.fill();
        this.ctx.strokeStyle = this.outline;
        this.ctx.stroke();

        this.ctx.restore();

        // WAIST JOINT
        this._joint(x, y + 5, 26);

        // PELVIS
        this.ctx.save();
        this.ctx.translate(x, y + 65);

        this.ctx.beginPath();
        this.ctx.roundRect( -45, -35, 90, 70, 20 );

        this.ctx.fillStyle = this.skin;
        this.ctx.fill();
        this.ctx.strokeStyle = this.outline;
        this.ctx.stroke();

        this.ctx.restore();

        // SHOULDERS
        const leftShoulder = {
            x: x - 55,
            y: y - 130
        };

        const rightShoulder = {
            x: x + 55,
            y: y - 130
        };

        this._joint(leftShoulder.x, leftShoulder.y, 18);
        this._joint(rightShoulder.x, rightShoulder.y, 18);

        // LEFT ARM
        let elbow = this._limb(
            leftShoulder.x,
            leftShoulder.y,
            2.0,
            95,
            28
        );

        this._joint(elbow.x, elbow.y, 14);

        let hand = this._limb(
            elbow.x,
            elbow.y,
            1.1,
            95,
            24
        );

        this._joint(hand.x, hand.y, 10);

        // RIGHT ARM
        elbow = this._limb(
            rightShoulder.x,
            rightShoulder.y,
            1.4,
            95,
            28
        );

        this._joint(elbow.x, elbow.y, 14);

        hand = this._limb(
            elbow.x,
            elbow.y,
            0.05,
            90,
            24
        );

        this._joint(hand.x, hand.y, 10);

        // HIPS
        const leftHip = {
            x: x - 22,
            y: y + 90
        };

        const rightHip = {
            x: x + 22,
            y: y + 90
        };

        this._joint(leftHip.x, leftHip.y, 14);
        this._joint(rightHip.x, rightHip.y, 14);

        // LEFT LEG
        let knee = this._limb(
            leftHip.x,
            leftHip.y,
            1.6,
            120,
            34
        );

        this._joint(knee.x, knee.y, 12);

        let ankle = this._limb(
            knee.x,
            knee.y,
            1.85,
            120,
            28
        );

        this._joint(ankle.x, ankle.y, 10);

        // RIGHT LEG
        knee = this._limb(
            rightHip.x,
            rightHip.y,
            1.65,
            120,
            34
        );

        this._joint(knee.x, knee.y, 12);

        ankle = this._limb(
            knee.x,
            knee.y,
            1.55,
            120,
            28
        );

        this._joint(ankle.x, ankle.y, 10);
    }    
}