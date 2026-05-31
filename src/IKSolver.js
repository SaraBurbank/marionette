export class IKSolver {
    constructor (skeleton) {
        this.skeleton = skeleton;
        this.tolerance = 1.0;
        this.maxIterations = 20; // iterations per frame per chain (higher = slower)
        this.blendFactor = 0.5; // smooth IK transitions
        this.constraintDefaults = {
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
        this.targets = [];
    }
    addTarget(boneName, rootName, constraints = {}) {
        const tip = this.skeleton.getBone(boneName);
        const mergedConstraints = { ...this.constraintDefaults, ...constraints };
        this.targets.push({
            boneName,
            rootName,
            targetX: tip.tailX, // start at current tip position
            targetY: tip.tailY,
            active: false,       // skip this target - inactive until user drags the effector
            constraints: mergedConstraints,
        });
        return this.targets.length - 1;
    }   
    setTarget(index, x, y) {
        const t = this.targets[index];
        if (!t) return;
        t.targetX = x;
        t.targetY = y;
        t.active  = true;
    } 
    releaseTarget(index) {
        const t = this.targets[index];
        if (t) t.active = false;
    }
    solve() { // FABRIK on all chains
        for (const target of this.targets) {
            if (!target.active) continue;
            this._solveChain(target);
        }
    }
    _solveChain(target) { // FABRIK on 1 chain 
        const {boneName, rootName, targetX, targetY, constraints } = target;
        const chain = this.skeleton.getChain(boneName, rootName);   // get ordered chain
        const positions = this._getPositions(chain)

        // set anchor
        const anchorX = positions[positions.length-1].x;
        const anchorY = positions[positions.length-1].y;    
        
        // check if target reachable
        const totalLength = chain.reduce((sum, b) => sum + b.length, 0);
        const distToTarget = Math.hypot(targetX - anchorX, targetY - anchorY);

        if (distToTarget >= totalLength) {
            this._stretchToward(chain, positions, anchorX, anchorY, targetX, targetY);  // if target is not reachable, stretch
        } else {    // run Fabrik
            for (let i = 0; i < this.maxIterations; i++) {
                const tipDist = Math.hypot(
                    positions[0].x - targetX,
                    positions[0].y - targetY
                );
                if (tipDist < this.tolerance) break;
                this._backwardPass(chain, positions, targetX, targetY);
                this._forwardPass(chain, positions, anchorX, anchorY);
            }
        }
        this._applyPositions(chain, positions, constraints);  // convert positions to bone angles
    }
    _getPositions(chain) {
        const positions = [{
            x: chain[0].tailX,
            y: chain[0].tailY,
        }];

        for (const bone of chain) {
            positions.push({ x: bone.worldX, y: bone.worldY });
        }

        return positions;
    }
    _backwardPass(chain, positions, targetX, targetY) {
        positions[0].x = targetX;
        positions[0].y = targetY;
 
        for (let i = 0; i < chain.length - 1; i++) {     // move each joint toward the previous joint
            const boneLength = chain[i].length;
            const dx = positions[i].x - positions[i + 1].x;
            const dy = positions[i].y - positions[i + 1].y;
            const dist = Math.hypot(dx, dy) || 0.0001; // avoid div by zero
            const scale = boneLength / dist;
            positions[i + 1].x = positions[i].x - dx * scale;
            positions[i + 1].y = positions[i].y - dy * scale;
        }
    }
    _forwardPass(chain, positions, anchorX, anchorY) {
        const lastIdx = positions.length - 1;   // set root to OG position
        positions[lastIdx].x = anchorX;
        positions[lastIdx].y = anchorY;
 
        for (let i = chain.length - 1; i >= 0; i--) {
            const boneLength = chain[i].length;
            const dx = positions[i].x - positions[i + 1].x;
            const dy = positions[i].y - positions[i + 1].y;
            const dist = Math.hypot(dx, dy) || 0.0001;
            const scale = boneLength / dist;
            positions[i].x = positions[i + 1].x + dx * scale;
            positions[i].y = positions[i + 1].y + dy * scale;
        }
    }
    _stretchToward(chain, positions, anchorX, anchorY, targetX, targetY) {
        const dx = targetX - anchorX;
        const dy = targetY - anchorY;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const ux = dx / dist; // unit vector toward target
        const uy = dy / dist;
 
        let curX = anchorX; // place joints outward to target
        let curY = anchorY;
 
        for (let i = chain.length; i >= 0; i--) {
            positions[i].x = curX;
            positions[i].y = curY;
            if (i > 0) {
                const boneLength = chain[i - 1].length;
                curX += ux * boneLength;
                curY += uy * boneLength;
            }
        }
    }
    _applyPositions(chain, positions, constraints = {}) {
        for (let i = chain.length - 1; i >= 0; i--) {
            const bone = chain[i];
 
            // bone start and end positions
            const startPos = positions[i + 1];   // this bone's head/start
            const endPos = positions[i];         // this bone's tail/end
 
            // new pointing direction from start to tail
            const dx = endPos.x - startPos.x;
            const dy = endPos.y - startPos.y;
 
            // angle from +Y axis clockwise
            const worldAngle = Math.atan2(dx, dy);
 
            // local angle = world angle minus parent's world angle
            const parentWorldAngle = bone.parent ? bone.parent.worldAngle : 0;
            let localAngle = worldAngle - parentWorldAngle;
            localAngle = this._normalizeAngle(localAngle);
 
            // Apply joint constraints
            localAngle = this._clampAngle(bone.name, localAngle, constraints);
 
            const previousAngle = bone.localAngle;
            const angleDelta = this._normalizeAngle(localAngle - previousAngle);
            const blendedAngle = previousAngle + angleDelta * this.blendFactor;
            bone.localAngle = this._normalizeAngle(blendedAngle);
        }
    }
    _normalizeAngle(localAngle) {
        while (localAngle >  Math.PI) localAngle -= 2 * Math.PI;
        while (localAngle < -Math.PI) localAngle += 2 * Math.PI;
        return localAngle;
    }
    _clampAngle(boneName, angle, constraints) {
        const constraint = constraints[boneName];
        if (!constraint) return this._normalizeAngle(angle);
        const min = constraint.min ?? -Math.PI;
        const max = constraint.max ?? Math.PI;
        return Math.max(min, Math.min(max, this._normalizeAngle(angle)));
    }
    chainLength(chain) {
        return chain.reduce((sum, bone) => sum + bone.length, 0);
    }
}