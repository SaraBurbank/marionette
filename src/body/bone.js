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

        // squash and stretch
        this.prevTailX = 0;
        this.prevTailY = 0;
        this.velocity  = 0; // px/frame, smoothed

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
    rotate(delta, min = -Math.PI, max = Math.PI) {  // bone rotation
        this.localAngle = Math.max(min, Math.min(max, this.localAngle + delta));
    }
    setAngle(angle, min = -Math.PI, max = Math.PI) {    // bone's local angle
        this.localAngle = Math.max(min, Math.min(max, angle));
    }
    updateVelocity(smoothing = 0.8) {
        const raw = Math.hypot(this.tailX - this.prevTailX, this.tailY - this.prevTailY);
        this.velocity  = this.velocity * smoothing + raw * (1 - smoothing);
        this.prevTailX = this.tailX;
        this.prevTailY = this.tailY;
    }
}