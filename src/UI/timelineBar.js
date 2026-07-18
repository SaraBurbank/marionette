import { el, btn } from './domHelpers.js';

export class TimelineBar {
    constructor({ poseManager }) {
        this.poses = poseManager;

        this._bar = null;
        this._poseList = null;
        this._savePoseBtn = null;
        this._playBtn = null;
        this._speedSlider = null;
        this._thumbCache = new Map();

        this.poses.onStateChange((state) => this._onPoseStateChange(state));
    }
    mount() {
        this._bar = this._buildBar();
        document.body.appendChild(this._bar);
    }
    _buildBar() {
        const bar = el('div', 'mn-timeline');

        this._savePoseBtn = btn('Save Pose', () => {
            this.poses.savePose();
        });
        bar.appendChild(this._savePoseBtn);
        bar.appendChild(this._buildTrack());

        this._poseList = el('div', 'mn-timeline-pose-list');
        bar.appendChild(this._poseList);

        this._playBtn = btn('Play', () => {
            this.poses.isPlaying ? this.poses.stop() : this.poses.play();
        });
        this._playBtn.disabled = true;
        bar.appendChild(this._playBtn);

        bar.appendChild(this._buildSpeedSlider());
        return bar;
    }
    _buildTrack() {
        const track = el('div', 'mn-timeline-track');

        this._playhead = el('div', 'mn-timeline-playhead');
        track.appendChild(this._playhead);

        this._marksLayer = el('div', 'mn-timeline-marks');
        track.appendChild(this._marksLayer);

        this.poses.onProgress((progress) => this._onProgress(progress));

        return track;
    }
    _buildThumbnail(pose, index) {
        if (this._thumbCache.has(pose)) {
            return this._thumbCache.get(pose).cloneNode(true);
        }

        const bones = this.poses.getPoseSnapshot(index);
        if (!bones || bones.length === 0) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const b of bones) {
            minX = Math.min(minX, b.x1, b.x2);
            maxX = Math.max(maxX, b.x1, b.x2);
            minY = Math.min(minY, b.y1, b.y2);
            maxY = Math.max(maxY, b.y1, b.y2);
        }

        const pad = 10;
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute(
            'viewBox',
            `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
        );
        svg.classList.add('mn-timeline-thumb');

        for (const b of bones) {
            if (b.x1 === b.x2 && b.y1 === b.y2) continue;
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', b.x1);
            line.setAttribute('y1', b.y1);
            line.setAttribute('x2', b.x2);
            line.setAttribute('y2', b.y2);
            svg.appendChild(line);
        }

        this._thumbCache.set(pose, svg);
        return svg.cloneNode(true);
    }
    _buildSpeedSlider() {
        const row = el('div', 'mn-timeline-speed');

        const lbl = el('span', 'mn-slider-label');
        lbl.textContent = 'Speed';
        row.appendChild(lbl);

        const val = el('span', 'mn-slider-value');
        const initial = this.poses.speed ?? 1;
        val.textContent = `${initial.toFixed(2)}x`;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0.25;
        slider.max = 3;
        slider.step = 0.05;
        slider.value = initial;
        slider.classList.add('mn-slider');
        slider.setAttribute('aria-label', 'Playback speed');

        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value);
            val.textContent = `${v.toFixed(2)}x`;
            this.poses.setSpeed(v);
        });

        row.append(slider, val);
        this._speedSlider = { slider, valueLabel: val };
        return row;
    }
    _refreshMarks() {
        this._marksLayer.replaceChildren();

        const poses = this.poses.poses;
        const count = poses.length;

        poses.forEach((pose, index) => {
            const mark = el('div', 'mn-timeline-mark');
            mark.textContent = index + 1;
            mark.title = pose.name;
            mark.style.left = `${count > 1 ? (index / (count - 1)) * 100 : 0}%`;

            const thumb = this._buildThumbnail(pose, index);
            if (thumb) mark.appendChild(thumb);

            mark.addEventListener('click', () => this.poses.goToPose(index));

            this._marksLayer.appendChild(mark);
        });
    }
    _refreshPoseList() {
        this._poseList.replaceChildren();

        this.poses.poses.forEach((pose, index) => {
            const chip = el('div', 'mn-timeline-chip');

            const label = document.createElement('span');
            label.textContent = pose.name;

            const remove = btn('✕', () => {
                this.poses.removePose(index);
            });
            remove.classList.add('mn-delete-btn');

            chip.append(label, remove);
            this._poseList.appendChild(chip);
        });
    }
    _onPoseStateChange({ poseCount, isPlaying, speed }) {
        this._refreshPoseList();
        this._refreshMarks();

        this._playBtn.disabled = poseCount < 2;
        this._playBtn.textContent = isPlaying ? 'Stop' : 'Play';
        this._playBtn.classList.toggle('mn-btn-playing', isPlaying);

        if (!isPlaying) {
            const pos = poseCount > 1 ? this.poses.playIndex / (poseCount - 1) : 0;
            this._onProgress(pos);
        }

        if (this._speedSlider && speed !== undefined && document.activeElement !== this._speedSlider.slider) {
            this._speedSlider.slider.value = speed;
            this._speedSlider.valueLabel.textContent = `${speed.toFixed(2)}x`;
        }
    }
    _onProgress(progress) {
        if (!this._playhead) return;
        this._playhead.style.left = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    }
}