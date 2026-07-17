/** TODO
 * -> change from Pose A / Pose B save buttons + Play/Stop button to 
 *      save button and list of poses (you can remove them form the list (trash/'X' icon))
 * */
export class UIController {
    constructor({ poseManager, proportionController, inputHandler }) {
        this.poses = poseManager;
        this.proportions = proportionController;
        this.input = inputHandler;

        this._panel = null;   // root panel element
        this._modePill = null;   // FK/IK indicator element
        this._saveABtn = null;
        this._saveBBtn = null;
        this._playBtn = null;
        this._proportionSliders = [];

        // wire PoseManager state → button updates
        this.poses.onStateChange = (state) => this._onPoseStateChange(state);
    }
    mount() {   // mount UI panel into the document
        // this._injectStyles();
        this._panel = this._buildPanel();
        document.body.appendChild(this._panel);
    }
    update() {  // mode update based of input (drag mode)
        if (!this._modePill) return;

        // InputHandler is in IK mode when a drag started on a registered effector
        const isIK = this.input._draggingIK || this.input._activeIKidX !== null;
        this._modePill.textContent = isIK ? 'IK' : 'FK';
        this._modePill.dataset.mode = isIK ? 'ik' : 'fk';
    }
    _buildPanel() {
        const panel = el('div', 'mn-panel');

        panel.appendChild(this._buildModeSection());    // mode indicator
        panel.appendChild(divider());

        panel.appendChild(this._buildPoseSection());    // pose controls (change it to it's own thing and add zoom here)
        panel.appendChild(divider());

        panel.appendChild(this._buildProportionSection());  // proportion sliders
        panel.appendChild(divider());

        panel.appendChild(this._buildResetSection());   // reset button
        return panel;
    }
    _buildModeSection() {
        const wrap = el('div', 'mn-section');
        wrap.appendChild(label('Mode'));

        this._modePill = el('span', 'mn-mode-pill');
        this._modePill.textContent = 'FK';
        this._modePill.dataset.mode = 'fk';
        this._modePill.title = 'Drag a limb end to enter IK mode; drag anywhere else for FK';
        wrap.appendChild(this._modePill);
        return wrap;
    }
    _buildPoseSection() {
        const wrap = el('div', 'mn-section');
        wrap.appendChild(label('Poses'));

        // TODO: Change the save part where it's one button and a list of poses (that way I can do more later)
        const saveRow = el('div', 'mn-row');

        this._saveABtn = btn('Save A', () => { this.poses.saveA() });
        this._saveABtn.title = 'Capture current pose as Pose A';

        this._saveBBtn = btn('Save B', () => { this.poses.saveB() });
        this._saveBBtn.title = 'Capture current pose as Pose B';
        this._saveBBtn.disabled = true; // enable after A is saved

        saveRow.appendChild(this._saveABtn);
        saveRow.appendChild(this._saveBBtn);
        wrap.appendChild(saveRow);

        // Play button (full width)
        this._playBtn = btn('Play', () => {
            if (this.poses.isPlaying) {
                this.poses.stop();
            } else {
                this.poses.play();
            }
        });
        this._playBtn.classList.add('mn-btn-full');
        this._playBtn.disabled = true;  // enable after both poses saved
        this._playBtn.title = 'Play back interpolation between Pose A and Pose B';
        wrap.appendChild(this._playBtn);

        wrap.appendChild(this._buildSpeedSlider());
        return wrap;
    }
    _buildSpeedSlider() {
        const row = el('div', 'mn-slider-row');
        const lbl = el('span', 'mn-slider-label');
        lbl.textContent = 'Speed';
        row.appendChild(lbl);

        const val = el('span', 'mn-slider-value');
        const initial = this.poses.speed ?? 1;
        val.textContent = `${initial.toFixed(2)}x`;

        const slider = document.createElement('input');
        slider.type  = 'range';
        slider.min   = 0.25;
        slider.max   = 3;
        slider.step  = 0.05;
        slider.value = initial;
        slider.classList.add('mn-slider');
        slider.setAttribute('aria-label', 'Playback speed');

        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value);
            val.textContent = `${v.toFixed(2)}x`;
            this.poses.setSpeed(v);
        });

        row.appendChild(slider);
        row.appendChild(val);
        this._speedSlider = { slider, valueLabel: val };
        return row;
    }
    _buildProportionSection() {
        const wrap = el('div', 'mn-section');
        wrap.appendChild(label('Proportions'));

        const sliderDefs = [
            { key: 'spine', label: 'Spine',  min: 0.4, max: 2.0, step: 0.05, default: 1.0 },
            { key: 'arms',  label: 'Arms',   min: 0.4, max: 2.0, step: 0.05, default: 1.0 },
            { key: 'legs',  label: 'Legs',   min: 0.4, max: 2.0, step: 0.05, default: 1.0 },
            { key: 'head',  label: 'Head',   min: 0.5, max: 1.8, step: 0.05, default: 1.0 },
        ];
        this._proportionSliders = [];
        for (const def of sliderDefs) {
            wrap.appendChild(this._buildSlider(def));
        }
        const resetBtn = btn('Reset', () => {
            this.proportions.reset();
            for (const item of this._proportionSliders) {
                item.slider.value = item.defaultVal;
                item.valueLabel.textContent = item.defaultVal.toFixed(2);
            }
        });
        wrap.appendChild(resetBtn);
        return wrap;
    }
    _buildSlider({ key, label: labelText, min, max, step, default: defaultVal }) {
        const row = el('div', 'mn-slider-row');
        const lbl = el('span', 'mn-slider-label');
        lbl.textContent = labelText;
        row.appendChild(lbl);

        const val = el('span', 'mn-slider-value');
        val.textContent = defaultVal.toFixed(2);

        const slider = document.createElement('input');
        slider.type  = 'range';
        slider.min   = min;
        slider.max   = max;
        slider.step  = step;
        slider.value = defaultVal;
        slider.classList.add('mn-slider');
        slider.setAttribute('aria-label', `${labelText} proportion`);

        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value);
            val.textContent = v.toFixed(2);
            this.proportions.set(key, v);
        });

        row.appendChild(slider);
        row.appendChild(val);
        this._proportionSliders.push({ key, slider, valueLabel: val, defaultVal });
        return row;
    }
    _buildResetSection() {
        const wrap = el('div', 'mn-section');
        const resetBtn = btn('Reset pose', () => {
            if (this.poses.hasA) {
                this.poses.reset();
            }
        });
        resetBtn.classList.add('mn-btn-full');
        resetBtn.title = 'Jump back to Pose A (or default if Pose A not saved)';
        wrap.appendChild(resetBtn);
        return wrap;
    }
    _onPoseStateChange({ hasA, hasB, isPlaying, speed }) {
        if (!this._saveABtn) return;

        // Mark save buttons when a pose is captured
        this._saveABtn.classList.toggle('mn-btn-saved', hasA);
        this._saveABtn.textContent = hasA ? 'Pose A ✓' : 'Save A';

        // Enable Save B only after A is saved (encourages correct workflow)
        this._saveBBtn.disabled = !hasA;
        this._saveBBtn.classList.toggle('mn-btn-saved', hasB);
        this._saveBBtn.textContent = hasB ? 'Pose B ✓' : 'Save B';

        // Play button enables only when both poses exist
        this._playBtn.disabled = !(hasA && hasB);
        this._playBtn.textContent = isPlaying ? 'Stop' : 'Play';
        this._playBtn.classList.toggle('mn-btn-playing', isPlaying);

        // Reflect speed changes that came from outside the slider (e.g. poses.import())
        if (this._speedSlider && speed !== undefined && document.activeElement !== this._speedSlider.slider) {
            this._speedSlider.slider.value = speed;
            this._speedSlider.valueLabel.textContent = `${speed.toFixed(2)}x`;
        }
    }
}

// DOM helpers
function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
}
function label(text) {
    const l = el('span', 'mn-label');
    l.textContent = text;
    return l;
}
function btn(text, onClick) {
    const b = el('button', 'mn-btn');
    b.textContent = text;
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
}
function divider() {
    return el('div', 'mn-divider');
}