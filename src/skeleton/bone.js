export class Bone {
    constructor(name, length, parent = null) {
        this.name = name;
        this.length = length;
        this.parent = parent;

        this.children = [];
        this.localAngle = 0; // rotation based on parent (0=down)

        // bone's START position and angle in world
        this.worldX = 0; 
        this.worldY = 0;
        this.worldAngle = 0;

        if (parent) { // set bone child relationship
            parent.children.push(this);
        }
    }

    // bone's END point position
    get tailX() {
        return this.worldX + Math.sin(this.worldAngle) * this.length;
    }
    get tailY() {
        return this.worldY + Math.cos(this.worldAngle) * this.length;
    }

    // bone rotation
    rotate(delta, min = -Math.PI, max = Math.PI) {
        this.localAngle = Math.max(min, Math.min(max, this.localAngle + delta));
    }

    // bone's local angle
    setAngle(angle, min = -Math.PI, max = Math.PI) {
        this.localAngle = Math.max(min, Math.min(max, angle));
    }
}