export class InputHandler {
    constructor(canvas, skeleton) {
        this.canvas = canvas;
        this.skeleton = skeleton;
 
        // Track pointer state
        this._isDown = false;
        this._lastX = 0;
        this._lastY = 0;
        this.sensitivity = 100; // mouse drag sensitivity -> lower = more sensitive
        this._bindEvents();
    }
    _bindEvents() {
         const c = this.canvas;

        // Mouse
        c.addEventListener('mousedown',  e => this._onDown(e));
        c.addEventListener('mousemove',  e => this._onMove(e));
        c.addEventListener('mouseup',    e => this._onUp(e));
        c.addEventListener('mouseleave', e => this._onUp(e));
 
        // Touch (mobile/tablet support)
        c.addEventListener('touchstart', e => this._onDown(e.touches[0]), { passive: true });
        c.addEventListener('touchmove',  e => this._onMove(e.touches[0]), { passive: true });
        c.addEventListener('touchend',   e => this._onUp(e));
    }
    _getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }
    _onDown(e) {
        this._isDown = true;
        const { x, y } = this._getPos(e);
        this._lastX = x;
        this._lastY = y;
        
        const hit = this.skeleton.getBoneAt(x, y, 24);
        this.skeleton.selectedBone = hit; // null if empty space clicked
    }
    _onMove(e) {
        if (!this._isDown || !this.skeleton.selectedBone) return;
 
        const { x, y } = this._getPos(e);
        const dx = x - this._lastX;
        const delta = dx / this.sensitivity;
        this.skeleton.selectedBone.rotate(delta);
 
        this._lastX = x;
        this._lastY = y;
    }
 
    _onUp() {
        this._isDown = false;
    }
}