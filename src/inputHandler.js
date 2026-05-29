export class InputHandler {
    constructor(canvas, skeleton, ikSolver) {
        this.canvas = canvas;
        this.skeleton = skeleton;
        this.ikSolver = ikSolver
 
        // Track pointer state
        this._isDown = false;
        this._lastX = 0;
        this._lastY = 0;
        this._activeIKidX = null;
        this._draggingIK = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragThreshold = 8;
        this.sensitivity = 100; // mouse drag sensitivity -> lower = more sensitive
        
        this._effectorMap = {};
        this._bindEvents();
    }
    setEffector(boneName, targetIndex) {
        this._effectorMap[boneName] = targetIndex;
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
    _getPos(e) {    // get position of mouse on canvas
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    _onDown(e) {
        this._isDown = true;
        const { x, y } = this._getPos(e);
        this._lastX = x;
        this._lastY = y;
        
        const hit = this.skeleton.getBoneAt(x, y, 24);
        this.skeleton.selectedBone = hit; // null if empty space clicked
        this._activeIKidX = null;

        if (!hit) return;
        if (this._effectorMap.hasOwnProperty(hit.name)) {
            this._activeIKidX = this._effectorMap[hit.name];
            this._draggingIK = false;
            this._dragStartX = x;
            this._dragStartY = y;
        }
    }
    _onMove(e) {
        if (!this._isDown) return;
        const { x, y } = this._getPos(e);
        const dragDist = Math.hypot(x - this._dragStartX, y - this._dragStartY);

        if (this._activeIKidX !== null) {
            if (!this._draggingIK && dragDist >= this._dragThreshold) {
                this._draggingIK = true;
            }
            if (this._draggingIK) {
                this.ikSolver.setTarget(this._activeIKidX, x, y);
            }
        } else if (this.skeleton.selectedBone) {
        
        if (this._activeIKidX !== null) {
            this.ikSolver.setTarget(this._activeIKidX, x, y);
        } else if (this.skeleton.selectedBone) {
            const dx = x - this._lastX;
            this.skeleton.selectedBone.rotate(dx / this.sensitivity);
        }
 
        this._lastX = x;
        this._lastY = y;
        }
    }
    _onUp() {
        this._isDown = false;
        if (this._activeIKidX !== null && this._draggingIK) {
            this.ikSolver.releaseTarget(this._activeIKidX);
        }
        this._activeIKidX = null;
        this._draggingIK = false;
    }
}