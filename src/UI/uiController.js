/** TODO
 * -> change from Pose A / Pose B save buttons + Play/Stop button to 
 *      save button and list of poses (you can remove them form the list (trash/'X' icon))
 * -> insert the css from a file instead of everything here, like this:
 *      let link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'styles.css';
        document.head.appendChild(link);
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
        this._injectStyles();
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
        return wrap;
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
    //  TODO: Change Pose state → UI and insectStyle
    _onPoseStateChange({ hasA, hasB, isPlaying }) {
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
    }
    _injectStyles() {
        if (document.getElementById('mn-styles')) return; // already injected
        const style = document.createElement('style');
        style.id = 'mn-styles';
        style.textContent = `
            .mn-panel {
                position: fixed;
                top: 20px;
                left: 20px;
                z-index: 100;
                width: 200px;
                background: rgba(20, 20, 20, 0.88);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 0.5px solid rgba(255,255,255,0.12);
                border-radius: 12px;
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 12px;
                color: rgba(255,255,255,0.85);
                user-select: none;
            }
            .mn-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 10px 0;
            }
            .mn-section:first-child { padding-top: 0; }
            .mn-section:last-child  { padding-bottom: 0; }
            .mn-label {
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: rgba(255,255,255,0.4);
            }
            .mn-divider {
                height: 0.5px;
                background: rgba(255,255,255,0.10);
                margin: 0;
                flex-shrink: 0;
            }
            .mn-mode-pill {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.06em;
                width: fit-content;
                transition: background 0.15s, color 0.15s;
            }
            .mn-mode-pill[data-mode="fk"] {
                background: rgba(255,255,255,0.10);
                color: rgba(255,255,255,0.7);
            }
            .mn-mode-pill[data-mode="ik"] {
                background: rgba(122, 244, 235, 0.18);
                color: #7af4eb;
            }
            .mn-row {
                display: flex;
                gap: 6px;
            }
            .mn-btn {
                flex: 1;
                padding: 6px 8px;
                background: rgba(255,255,255,0.07);
                border: 0.5px solid rgba(255,255,255,0.15);
                border-radius: 6px;
                color: rgba(255,255,255,0.8);
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.12s, border-color 0.12s, transform 0.08s;
                white-space: nowrap;
                text-align: center;
            }
            .mn-btn:hover:not(:disabled) {
                background: rgba(255,255,255,0.13);
                border-color: rgba(255,255,255,0.25);
            }
            .mn-btn:active:not(:disabled) {
                transform: scale(0.97);
            }
            .mn-btn:disabled {
                opacity: 0.35;
                cursor: not-allowed;
            }
            .mn-btn-full {
                width: 100%;
            }
            .mn-btn-saved {
                border-color: rgba(122, 244, 235, 0.4);
                color: #7af4eb;
            }
            .mn-btn-playing {
                background: rgba(122, 244, 235, 0.12);
                border-color: rgba(122, 244, 235, 0.5);
                color: #7af4eb;
            }
            .mn-slider-row {
                display: grid;
                grid-template-columns: 44px 1fr 32px;
                align-items: center;
                gap: 6px;
            }
            .mn-slider-label {
                font-size: 11px;
                color: rgba(255,255,255,0.6);
            }
            .mn-slider-value {
                font-size: 10px;
                color: rgba(255,255,255,0.4);
                text-align: right;
                font-variant-numeric: tabular-nums;
            }
            .mn-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 3px;
                background: rgba(255,255,255,0.15);
                border-radius: 2px;
                outline: none;
                cursor: pointer;
            }
            .mn-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #7af4eb;
                cursor: pointer;
                transition: transform 0.1s;
            }
            .mn-slider::-webkit-slider-thumb:hover {
                transform: scale(1.2);
            }
            .mn-slider::-moz-range-thumb {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #7af4eb;
                border: none;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
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