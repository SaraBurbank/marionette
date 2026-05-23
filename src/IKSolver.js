export class IKSolver {
    constructor (skeleton) {
        this.skeleton = skeleton;
        this.tolerance = 0.5
        this.maxIterations = 10; // iterations per frame per chain (higher = slower)
        this.targets = [];
        /**
         * Structure:
         * {
         *   boneName:  'R_Hand',       // bone at the end of the chain
         *   rootName: 'R_Shoulder',   // bone at the start (stays anchored)
         *   targetX:  400,            // world X the tip reaches for
         *   targetY:  300,            // world Y the tip reaches for
         *   active:   true,           // false = skip this target this frame
         *   constraints: {            // optional per-joint angle limits (radians)
         *     'R_Forearm': { min: -0.1, max: Math.PI * 0.9 },
         *   }
         */
    }
    addTarget(boneName, rootName, constraints = {}) {
        const tip = this.skeleton.getBone(boneName);
        this.targets.push({
            boneName,
            rootName,
            targetX: tip.tailX, // start at current tip position
            targetY: tip.tailY,
            active: false,       // inactive until user drags the effector
            constraints,
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
        const positions = chain.map(bone => ({
            x: bone.worldX,
            y: bone.worldY,
        }));

        const root = chain[chain.length - 1];
        positions.push({ x: root.tailX, y: root.tailY });
 
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
 
        for (let i = chain.length - 1; i > 0; i--) {    // move each joint away the previous joint
            const boneLength = chain[i].length;
            const dx = positions[i - 1].x - positions[i].x;
            const dy = positions[i - 1].y - positions[i].y;
            const dist = Math.hypot(dx, dy) || 0.0001;
            const scale = boneLength / dist;
            positions[i - 1].x = positions[i].x + dx * scale;
            positions[i - 1].y = positions[i].y + dy * scale;
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
    _applyPositions(chain, positions, constraints) {
        for (let i = chain.length - 1; i >= 0; i--) {
            const bone = chain[i];
 
            // vector joint to next joint
            const nextPos = positions[i];       // this bone's head
            const prevPos = positions[i + 1];   // parent joint
 
            // new pointing direction
            const dx = nextPos.x - prevPos.x;
            const dy = nextPos.y - prevPos.y;
 
            // angle from +Y axis clockwise
            const worldAngle = Math.atan2(dx, dy);
 
            // local angle = world angle minus parent's world angle
            const parentWorldAngle = bone.parent ? bone.parent.worldAngle : 0;
            let localAngle = worldAngle - parentWorldAngle;
            localAngle = this._normalizeAngle(localAngle);
 
            // Apply joint constraints
            if (constraints[bone.name]) {
                const { min, max } = constraints[bone.name];
                localAngle = Math.max(min, Math.min(max, localAngle));
            }
 
            bone.localAngle = localAngle;
        }
    }
    _normalizeAngle(localAngle) {
        while (localAngle >  Math.PI) localAngle -= 2 * Math.PI;
        while (localAngle < -Math.PI) localAngle += 2 * Math.PI;
        return localAngle;
    }
    // chainLength(chain) {
    //     return chain.reduce((sum, bone) => sum + bone.length, 0);
    // }
}