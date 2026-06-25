/**
 * todo: change pose system to have save pose to a list of poses
 * USAGE:
 *   const poses = new PoseManager(skeleton, ikSolver);
 *
 *   poses.saveA();          // capture current skeleton state as Pose A
 *   poses.saveB();          // capture as Pose B
 *   poses.play();           // tween A → B → A (or one-way — see options)
 *   poses.stop();           // cancel active tween, keep current angles
 *
 */

export class PoseManager {
    constructor(skeleton, ikSolver, options = {}) {
        this.skeleton = skeleton;
        this.ikSolver = ikSolver;

        this.duration = options.duration;
        this.ease = options.ease;
        this.pingPong = options.pingPong;
        this.holdTime = options.holdTime;

        this._originalPose = this._capture();
        this._poseA = null;    // { boneName: localAngle }
        this._poseB = null;
        this._tween = null;    // active GSAP tween
        this._playing = false;

        this.onStateChange = null;
    }
    saveA() {
        this._poseA = this._capture();
        this._notify();
    }
    saveB() {
        this._poseB = this._capture();
        this._notify();
    }

    get hasA() { return this._poseA !== null; }     // if Pose A has been saved
    get hasB() { return this._poseB !== null; }     // if Pose B has been saved
    get isPlaying() { return this._playing; }       // if tween is running

    play() {
        if (!this._poseA || !this._poseB) {
            console.warn('PoseManager.play: both poses must be saved first.');
            return;
        }
        this.stop();
        this._pauseIK();
        this._playing = true;
        this._notify();

        if (this.pingPong) {
            this._playPingPong();
        } else {
            this._playOneWay();
        }
    }
    stop() {
        if (this._tween) {
            this._tween.kill();
            this._tween = null;
        }
        this._playing = false;
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
    _playOneWay() {
        // Apply Pose A immediately, then tween to Pose B
        this._applyPose(this._poseA);
        this.skeleton.update();

        const targets = this._buildTweenTargets(this._poseB);
        this._tween = gsap.to(targets, {
            duration:   this.duration,
            ease:       this.ease,
            onUpdate:   () => this._flushTweenTargets(targets),
            onComplete: () => this._onPlaybackEnd(),
        });
    }
    _playPingPong() {
        // A → B, pause, B → A, pause, repeat
        const toB = () => {
            this._applyPose(this._poseA);
            this.skeleton.update();
            const targets = this._buildTweenTargets(this._poseB);
            this._tween = gsap.to(targets, {
                duration:   this.duration,
                ease:       this.ease,
                onUpdate:   () => this._flushTweenTargets(targets),
                onComplete: () => {
                    if (!this._playing) return;
                    // Hold at B, then tween back to A
                    this._tween = gsap.delayedCall(this.holdTime, toA);
                },
            });
        };
        const toA = () => {
            if (!this._playing) return;
            this._applyPose(this._poseB);
            this.skeleton.update();
            const targets = this._buildTweenTargets(this._poseA);
            this._tween = gsap.to(targets, {
                duration:   this.duration,
                ease:       this.ease,
                onUpdate:   () => this._flushTweenTargets(targets),
                onComplete: () => {
                    if (!this._playing) return;
                    // Hold at A, then loop back to B
                    this._tween = gsap.delayedCall(this.holdTime, toB);
                },
            });
        };
        toB();
    }
    _onPlaybackEnd() {
        this._playing = false;
        this._resumeIK();
        this._notify();
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
        for (const [name, targetAngle] of Object.entries(toPose)) {
            try {
                const bone = this.skeleton.getBone(name);
                proxy[name] = bone.localAngle;       // start value (current)
                proxy[`_target_${name}`] = targetAngle; // end value (stored for reference)
            } catch { 
                console.log(`Bone ${name} not found`);
             }
        }
        return proxy;
    }
    _flushTweenTargets(targets) {
        for (const [key, value] of Object.entries(targets)) {
            if (key.startsWith('_target_')) continue;
            try {
                const bone = this.skeleton.getBone(key);
                bone.localAngle = value;
            } catch { 
                console.log(`Bone ${key} not found`);
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
        return { poseA: this._poseA, poseB: this._poseB };
    }
    import(data) {
        this._poseA = data.poseA ?? null;
        this._poseB = data.poseB ?? null;
        this._notify();
    }
    _notify() {
        if (typeof this.onStateChange === 'function') {
            this.onStateChange({
                hasA:      this.hasA,
                hasB:      this.hasB,
                isPlaying: this.isPlaying,
            });
        }
    }
}