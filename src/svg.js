export class SVGCharacterBridge {
    constructor(skeleton, svgElement) {
        this.skeleton   = skeleton;
        this.svg        = svgElement;
        this._partCache = {}; // cache querySelector results

        // Draw order: back-to-front using SVG z-order (earlier = behind)
        // Re-order the SVG children to match this list on mount
        this.drawOrder = [
            'L_UpperLeg', 'L_Shin', 'L_Foot',
            'L_UpperArm', 'L_Forearm', 'L_Hand',
            'Hip', 'Spine', 'Chest',
            'R_UpperLeg', 'R_Shin', 'R_Foot',
            'R_UpperArm', 'R_Forearm', 'R_Hand',
            'Neck', 'Head',
        ];
    }

    // Call once after mounting to cache all part elements
    init() {
        for (const boneName of this.drawOrder) {
            const el = this.svg.querySelector(`#part-${boneName}`);
            console.log(el);
            if (el) this._partCache[boneName] = el;
        }
        this._applyDrawOrder();
    }

    // Call every frame in your loop
    update() {
        for (const boneName of this.drawOrder) {
            const el   = this._partCache[boneName];
            const bone = this._getBone(boneName);
            if (!el || !bone) continue;

            // Position at bone head, rotate to match bone angle.
            // worldAngle 0 = pointing down = 0 radians in our convention.
            // SVG rotate() uses degrees and is clockwise — same as our convention.
            const deg = bone.worldAngle * (180 / Math.PI);
            el.setAttribute(
                'transform',
                `translate(${bone.worldX}, ${bone.worldY}) rotate(${deg})`
            );
        }
    }

    // Re-order SVG children to match drawOrder (back-to-front)
    _applyDrawOrder() {
        for (const boneName of this.drawOrder) {
            const el = this._partCache[boneName];
            if (el) this.svg.appendChild(el); // moves to end = front
        }
    }

    _getBone(name) {
        try   { return this.skeleton.getBone(name); }
        catch { return null; }
    }
}