export class PoseManager {
    constructor(skeleton, ikSolver, options = {}) {
        this.skeleton = skeleton;
        this.ikSolver = ikSolver;

        this.duration = options.duration;
        this.ease = options.ease;
        this.pingPong = options.pingPong;
        this.holdTime = options.holdTime;
        this.speed = options.speed ?? 1;   // playback speed multiplier (1 = normal)

        this._originalPose = this._capture();
        this._poses = [];
        this._playIndex = 0;
        this._playDirection = 1;

        this._tween = null;    // active GSAP tween
        this._playing = false;

        this._listeners = [];
        this._progressListeners = [];
    }
    get hasPoses() { return this._poses.length > 0; }
    get playIndex() { return this._playIndex; }
    get poses() { return this._poses; }
    get isPlaying() { return this._playing; }
    savePose() {
        this._poses.push({
            name: `Pose ${this._poses.length + 1}`,
            pose: this._capture()
        });
        this._notify();
    }
    removePose(index) {
        this._poses.splice(index, 1);
        this._notify();
    }
    reorderPose(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= this._poses.length) return;
        if (toIndex < 0 || toIndex >= this._poses.length) return;

        if (this._playing) this.stop();

        const [moved] = this._poses.splice(fromIndex, 1);
        this._poses.splice(toIndex, 0, moved);

        if (this._playIndex === fromIndex) {
            this._playIndex = toIndex;
        } else if (fromIndex < this._playIndex && toIndex >= this._playIndex) {
            this._playIndex -= 1;
        } else if (fromIndex > this._playIndex && toIndex <= this._playIndex) {
            this._playIndex += 1;
        }
        this._notify();
    }
    goToPose(index) {
        if (index < 0 || index >= this._poses.length) return;
        this.stop();
        this._applyPose(this._poses[index].pose);
        this.skeleton.update();
        this._playIndex = index;
        this._notify();
    }
    getPoseSnapshot(index) {
        const pose = this._poses[index]?.pose;
        if (!pose) return null;

        const current = this._capture();   // save live pose

        this._applyPose(pose);
        this.skeleton.update();

        const bones = this.skeleton.getAllBones()
            .filter(b => b.length > 0)
            .map(b => ({
                x1: b.worldX, y1: b.worldY,
                x2: b.tailX,  y2: b.tailY
            }));

        this._applyPose(current);          // restore live pose
        this.skeleton.update();

        return bones;
    }
    play() {
        if (this._poses.length < 2) {
            console.warn('PoseManager.play: You need at least 2 poses to animate');
            return;
        }
        this.stop();
        this._pauseIK();
        this._playing = true;
        this._playIndex = 0;
        this._playDirection = 1;

        this._notify();

        this._playSequence();
    }
    stop() {
        if (this._tween) {
            this._tween.kill();
            this._tween = null;
        }
        this._playing = false;
        this._playDirection = 1;

        this._resumeIK();
        this._notify();
    }
    reset() {
        this.stop();
        this._applyPose(this._originalPose);
        this.skeleton.update();
    }
    onUserDrag() {
        if (this._playing) this.stop();
    }
    onStateChange(cb) { 
        this._listeners.push(cb); 
        return () => {
            const idx = this._listeners.indexOf(cb);
            if (idx !== -1) this._listeners.splice(idx, 1);
        };
    }
    onProgress(fn) {
        this._progressListeners.push(fn);
    }
    setSpeed(multiplier) {
        // non 0 value to not break GSAP
        this.speed = Math.max(0.05, multiplier);
        if (this._tween) {
            this._tween.timeScale(this.speed);
        }
        this._notify();
    }
    _playSegment(index) {
        if (!this._playing) return;

        if (index >= this._poses.length - 1) {
            this._onPlaybackEnd();
            return;
        }
        const from = this._poses[index].pose;
        const to   = this._poses[index + 1].pose;

        this._applyPose(from);
        this.skeleton.update();

        const targets = this._buildTweenTargets(to);

        this._tween = gsap.to(targets,
            this._tweenVars(targets, to, {
                duration: this.duration,
                ease: this.ease,

                onUpdate: () =>
                    this._flushTweenTargets(targets),
                onComplete: () =>
                    this._playSegment(index + 1)
            })
        );
        this._tween.timeScale(this.speed);
    }
    _playSequence() {
        if (!this._playing) return;
        let next = this._playIndex + this._playDirection;

        // ---- end ----
        if (next >= this._poses.length || next < 0) {
            if (!this.pingPong) {
                this._onPlaybackEnd();
                return;
            }
            this._playDirection *= -1;  // reverse direction
            next = this._playIndex + this._playDirection;
        }
        const fromPose = this._poses[this._playIndex].pose;
        const toPose   = this._poses[next].pose;

        this._applyPose(fromPose);
        this.skeleton.update();

        const targets = this._buildTweenTargets(toPose);

        this._tween = gsap.to(
            targets,
            this._tweenVars(targets, toPose, {
                duration: this.duration,
                ease: this.ease,

                onUpdate: () => {
                    this._flushTweenTargets(targets);
                    this._notifySegmentProgress(next);
                },
                onComplete: () => {
                    this._playIndex = next;
                    if (!this._playing) return;

                    this._tween = gsap.delayedCall(
                        this.holdTime,
                        () => this._playSequence()
                    );
                    this._tween.timeScale(this.speed);
                }
            })
        );
        this._tween.timeScale(this.speed);
    }
    _onPlaybackEnd() {
        this._playing = false;
        this._resumeIK();
        this._notify();
    }
    _notifySegmentProgress(next) {
        if (!this._tween || this._poses.length < 2) return;
        const segmentT = this._tween.progress();
        const pos = this._playIndex + (next - this._playIndex) * segmentT;
        this._notifyProgress(pos / (this._poses.length - 1));
    }
    _capture() {    // Snapshot all bone localAngles into a plain object
        const snapshot = {};
        for (const bone of this.skeleton.getAllBones()) {
            snapshot[bone.name] = bone.localAngle;
        }
        return snapshot;
    }
    _applyPose(pose) {
        for (const [name, angle] of Object.entries(pose)) {
            try {
                const bone = this.skeleton.getBone(name);
                bone.localAngle = angle;
            } catch { 
                console.log(`Bone ${name} not found`);
             }
        }
    }
    _buildTweenTargets(toPose) {
        const proxy = {};
        for (const name of Object.keys(toPose)) {
            try {
                const bone = this.skeleton.getBone(name);
                proxy[name] = bone.localAngle; // start value (current)
            } catch {
                console.log(`Bone ${name} not found`);
            }
        }
        return proxy;
    }
    _tweenVars(targets, toPose, extra) {
        const endValues = {};
        for (const name of Object.keys(targets)) {
            endValues[name] = toPose[name];
        }
        return { ...endValues, ...extra };
    }
    _flushTweenTargets(targets) {
        for (const [key, value] of Object.entries(targets)) {
            try {
                const bone = this.skeleton.getBone(key);
                bone.localAngle = value;
            } catch { 
                if (key !== "_gsap") {
                    console.log(`Bone ${key} not found`);
                }
            }
        }
        this.skeleton.update();
    }
    _pauseIK() {
        for (const target of this.ikSolver.targets) {
            target._wasActive = target.active;
            target.active = false;
        }
    }
    _resumeIK() {
        for (const target of this.ikSolver.targets) {
            if (target._wasActive !== undefined) {
                target.active = target._wasActive;
                delete target._wasActive;
            }
        }
    }
    export() {
        return { poses: this._poses, speed: this.speed };
    }
    import(data) {
        this._poses = data.poses ?? [];
        this.speed = data.speed ?? this.speed;
        this._notify();
    }
    _notify() {
        const state = { 
            poses: this._poses, 
            poseCount: this._poses.length, 
            isPlaying: this._playing, 
            speed: this.speed 
        };
        for (const fn of this._listeners) fn(state);
    }
    _notifyProgress(progress) {
        for (const fn of this._progressListeners) fn(progress);
    }
}