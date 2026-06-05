import { Bone } from './bone.js';

export class Skeleton {
    constructor (rootX, rootY) {
        this.rootX = rootX;
        this.rootY = rootY;

        this.bones = {}; // list of bodes
        this.root = null;
        this.bodyMap = {}; // list of matter.js bodies
        this.selectedBone = null; 
        this._build();
    }
    _build() {
        const hip = this._add(new Bone('Hip', 0, null));
        
        // Head + Torso (upward, offset the start angle)
        const spine = this._add(new Bone('Spine', 40, hip));
        const chest = this._add(new Bone('Chest', 50, spine));
        const neck = this._add(new Bone('Neck', 20, chest));
        const head = this._add(new Bone('Head', 35, neck));
 
        // Right arm 
        const rShoulder = this._add(new Bone('R_Shoulder', 20, chest));
        const rUpperArm = this._add(new Bone('R_UpperArm', 40, rShoulder));
        const rForearm = this._add(new Bone('R_Forearm', 38, rUpperArm));
        const rHand = this._add(new Bone('R_Hand', 20, rForearm));
 
        // Left arm 
        const lShoulder = this._add(new Bone('L_Shoulder', 20, chest));
        const lUpperArm = this._add(new Bone('L_UpperArm', 40, lShoulder));
        const lForearm = this._add(new Bone('L_Forearm', 38, lUpperArm));
        const lHand = this._add(new Bone('L_Hand', 20, lForearm));
 
        // Right leg 
        const rHip = this._add(new Bone('R_Hip', 15, hip));
        const rUpperLeg = this._add(new Bone('R_UpperLeg', 45, rHip));
        const rShin = this._add(new Bone('R_Shin', 42, rUpperLeg));
        const rFoot = this._add(new Bone('R_Foot', 20, rShin));
 
        // Left leg 
        const lHip = this._add(new Bone('L_Hip', 15, hip));
        const lUpperLeg = this._add(new Bone('L_UpperLeg', 45, lHip));
        const lShin = this._add(new Bone('L_Shin', 42, lUpperLeg));
        const lFoot = this._add(new Bone('L_Foot', 20, lShin));
 
        // Set the root and seed it at the world origin
        this.root = hip;
        this.root.worldX = this.rootX;
        this.root.worldY = this.rootY;
 
        // Rest pose: spine points UP (Math.PI = 180° = upward in our convention)
        spine.localAngle = Math.PI;
        chest.localAngle = 0;

        this.jointLimits = {
            Spine:      { min: Math.PI - 1.2, max: Math.PI + 1.2 },
            Chest:      { min: -1.0, max: 1.0 },
            R_Shoulder: { min: 0, max: Math.PI * 0.9 },
            R_UpperArm: { min: -Math.PI * 0.6, max: Math.PI * 0.6 },
            R_Forearm:  { min: 0.1, max: Math.PI * 0.95 },
            L_Shoulder: { min: -Math.PI * 0.9, max: 0 },
            L_UpperArm: { min: -Math.PI * 0.6, max: Math.PI * 0.6 },
            L_Forearm:  { min: -Math.PI * 0.95, max: -0.1 },
            R_Hip:      { min: -1.2, max: 1.0 },
            R_UpperLeg: { min: -1.0, max: 0.8 },
            R_Shin:     { min: -2.0, max: -0.1 },
            L_Hip:      { min: -1.0, max: 1.2 },
            L_UpperLeg: { min: -0.8, max: 1.0 },
            L_Shin:     { min: 0.1, max: 2.0 },
            Neck:       { min: -0.35, max: 0.35 },
            Head:       { min: -0.6, max: 0.6 },
        };
 
        // Arms angle outward from the chest
        rShoulder.localAngle =  Math.PI / 2;   // right = 90° clockwise
        lShoulder.localAngle = -Math.PI / 2;   // left  = 90° counter-clockwise
 
        // Legs angle slightly outward and downward
        rHip.localAngle =  0.15;
        lHip.localAngle = -0.15;
        
    }
    _add(bone) { // add bones to list
        this.bones[bone.name] = bone;
        return bone;
    }
    attachBodies(map) { // add matter.js bodies to list
        this.bodyMap = map;
    }
    syncBodiesToBones() { // FK calculations and updates
        for (const [boneName, body] of Object.entries(this.bodyMap)) {
            const bone = this.bones[boneName];
            if (!bone) continue;
            const tailX = bone.tailX;
            const tailY = bone.tailY;
            const midX = (bone.worldX + tailX) * 0.5;
            const midY = (bone.worldY + tailY) * 0.5;
 
            
            const boneAngle = Math.atan2(tailX - bone.worldX, tailY - bone.worldY);
            Matter.Body.setPosition(body, { x: midX, y: midY });
            Matter.Body.setAngle(body, boneAngle);
        }
    }
    update() {
        this._updateSubtree(this.root, this.rootX, this.rootY, 0);
    }
    _updateSubtree(bone, parentTailX, parentTailY, parentWorldAngle) {
        bone.worldAngle = parentWorldAngle + bone.localAngle;
        bone.worldX = parentTailX;
        bone.worldY = parentTailY;
        bone.updateVelocity(0.8);   // lower = snappier response

        const tailX = bone.tailX;
        const tailY = bone.tailY;
 
        for (const child of bone.children) {
            this._updateSubtree(child, tailX, tailY, bone.worldAngle);
        }
    }
    getBone(name) {
        const bone = this.bones[name];
        if (!bone) throw new Error(`Skeleton: no bone named "${name}"`);
        return bone;
    }
    getBoneLimits(name) {
        return this.jointLimits[name] || { min: -Math.PI, max: Math.PI };
    }
    getChain(tipName, rootName) {
        const chain = [];
        let current = this.getBone(tipName);
        while (current && current.name !== rootName) {
            chain.push(current);
            current = current.parent;
        }
        if (!current) throw new Error(`Skeleton.getChain: "${rootName}" is not an ancestor of "${tipName}"`);
        chain.push(current);
        return chain;
    }
    getAllBones() {
        return Object.values(this.bones);
    }
    drawBones(context) {
        const baseWidth  = 8;
        const maxStretch = 0.5; // 0.5 = 50% longer at full speed
        const maxSquash  = 0.35; // 0.35 = 35% narrower at full speed
        const speedCap   = 14;   // px/frame at which stretch 

        context.save();

        context.strokeStyle = '#fffcf2';
        context.lineWidth = 8;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.fillStyle = '#ffb703';

        for (const bone of this.getAllBones()) {
            if (bone.length === 0) continue;
            const factor = Math.min(bone.velocity / speedCap, 1);
 
            // Squash width only; keep the bone anchored between joints
            const stretchScale = 1 + factor * maxStretch;
            const squashScale  = 1 - factor * maxSquash;
            
            const stretchedLength = bone.length * stretchScale;
            const squashedWidth   = baseWidth   * squashScale;

            context.save();
            context.translate(bone.worldX, bone.worldY);
            context.rotate(-bone.worldAngle);

            const r = squashedWidth / 2; // corner radius = half width
            const w = squashedWidth;
            const h = stretchedLength;
            const x = -w / 2;
            const y = 0;

            context.beginPath();
            if (context.roundRect) {
                context.roundRect(x, y, w, h, r);
            } else {                    // Fallback for older browsers
                context.moveTo(x + r, y);
                context.lineTo(x + w - r, y);
                context.quadraticCurveTo(x + w, y, x + w, y + r);
                context.lineTo(x + w, y + h - r);
                context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                context.lineTo(x + r, y + h);
                context.quadraticCurveTo(x, y + h, x, y + h - r);
                context.lineTo(x, y + r);
                context.quadraticCurveTo(x, y, x + r, y);
                context.closePath();
            }
 
            // Fill with a subtle gradient — brighter when moving fast
            const alpha    = 0.25 + factor * 0.4; // 0.25 at rest → 0.65 at max speed
            const gradient = context.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, `rgba(255, 252, 242, ${alpha + 0.15})`);
            gradient.addColorStop(1, `rgba(255, 252, 242, ${alpha})`);
            context.fillStyle = gradient;
            context.fill();
 
            // Stroke — brighter when moving fast
            context.strokeStyle = `rgba(255, 252, 242, ${0.5 + factor * 0.5})`;
            context.lineWidth   = 1;
            context.stroke();
            context.restore();
 
            // Joint markers at bone head and tail
            const jointRadius = 3 + factor * 2; // 3px at rest, 5px at max speed
            context.beginPath();
            context.arc(bone.worldX, bone.worldY, jointRadius, 0, Math.PI * 2);
            context.fillStyle = `rgba(255, 183, 3, ${0.7 + factor * 0.3})`;
            context.fill();
        }
 
        context.restore();
    }
    getBoneAt(x, y, threshold = 20) {
        let closest = null;
        let closestDist = threshold;
 
        for (const bone of this.getAllBones()) {
            if (bone.length === 0) continue; 
 
            const startX = bone.worldX;
            const startY = bone.worldY;
            const endX = bone.tailX;
            const endY = bone.tailY;
            const dx = endX - startX;
            const dy = endY - startY;
            const lenSq = dx * dx + dy * dy;
            const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - startX) * dx + (y - startY) * dy) / lenSq));
            const projX = startX + dx * t;
            const projY = startY + dy * t;
            const dist = Math.hypot(x - projX, y - projY);
 
            if (dist < closestDist) { 
                closestDist = dist;
                closest = bone;
            }
        }
        return closest;
    }
}