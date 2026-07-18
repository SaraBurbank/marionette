import { el, label, btn, divider } from './domHelpers.js';

export class UIController {
    constructor({ poseManager, proportionController, inputHandler }) {
        this.poses = poseManager;
        this.proportions = proportionController;
        this.input = inputHandler;

        this._panel = null;   // root panel element
        this._modePill = null;   // FK/IK indicator element
        this._proportionSliders = [];

    }
    mount() {
        this._panel = this._buildPanel();
        document.body.appendChild(this._panel);
    }
    update() {
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
            if (this.poses.length > 0) {
                this.poses.reset();
            }
        });
        resetBtn.classList.add('mn-btn-full');
        resetBtn.title = 'Jump back to the original pose';
        wrap.appendChild(resetBtn);
        return wrap;
    }
}