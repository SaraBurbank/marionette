import { el, btn } from '../domHelpers.js';
import { buildShareUrl } from '../video/URLsharing.js';
import { VideoExporter } from '../video/videoExporter.js';

export class TimelineBar {
    constructor({ poseManager, canvas }) {
        this.poses = poseManager;
        this.canvas = canvas ?? null;
        this._videoExporter = this.canvas ? new VideoExporter({ canvas: this.canvas, poseManager }) : null;

        this._bar = null;
        this._track = null;
        this._marksLayer = null;
        this._playhead = null;
        this._savePoseBtn = null;
        this._playBtn = null;
        this._shareBtn = null;
        this._exportBtn = null;
        this._speedSlider = null;
        this._thumbCache = new Map();

        this._dragFromIndex = null;   // index currently being dragged, if any

        this.poses.onStateChange((state) => this._onPoseStateChange(state));
        this.poses.onProgress((progress) => this._onProgress(progress));
    }
    mount() {
        this._bar = this._buildBar();
        document.body.appendChild(this._bar);
        this._refreshMarks();   // show empty-state / any pre-existing poses immediately
    }
    _buildBar() {
        const bar = el('div', 'mn-timeline');

        bar.appendChild(this._buildControlsRow());
        bar.appendChild(this._buildTrack());

        return bar;
    }
    _buildControlsRow() {
        const row = el('div', 'mn-timeline-controls');

        this._savePoseBtn = btn('Save Pose', () => this.poses.savePose());
        row.appendChild(this._savePoseBtn);

        this._resetBtn = btn('Reset pose', () => {
            this.poses.reset();
        });
        row.appendChild(this._resetBtn);

        this._playBtn = btn('Play', () => {
            this.poses.isPlaying ? this.poses.stop() : this.poses.play();
        });
        this._playBtn.disabled = true;
        row.appendChild(this._playBtn);

        row.appendChild(this._buildSpeedSlider());

        this._shareBtn = btn('Share', () => this._onShareClick());
        this._shareBtn.title = 'Copy a link that loads this pose sequence';
        this._shareBtn.disabled = true;   // enabled once at least one pose exists
        row.appendChild(this._shareBtn);

        this._exportBtn = btn('Export Video', () => this._onExportClick());
        this._exportBtn.title = this.canvas
            ? 'Record this sequence as a WebM video'
            : 'Video export unavailable — no canvas was passed to TimelineBar';
        this._exportBtn.disabled = true;
        // row.appendChild(this._exportBtn);

        return row;
    }
    async _onShareClick() {
        if (!this.poses.hasPoses) return;
        const url = buildShareUrl(this.poses.export());
        try {
            await navigator.clipboard.writeText(url);
            this._flashBtn(this._shareBtn, 'Copied!');
        } catch (err) {
            console.warn('TimelineBar: clipboard write failed, falling back to prompt', err);
            window.prompt('Copy this link:', url);
        }
    }
    async _onExportClick() {
        if (!this._videoExporter || this._videoExporter.recording) return;
        if (this.poses.poses.length < 2) {
            window.alert('Save at least 2 poses before exporting a video.');
            return;
        }
        const original = this._exportBtn.textContent;
        this._exportBtn.disabled = true;
        this._exportBtn.textContent = 'Recording…';
        try {
            await this._videoExporter.recordSequence();
            this._exportBtn.textContent = 'Downloaded!';
        } catch (err) {
            console.warn('TimelineBar: video export failed', err);
            this._exportBtn.textContent = 'Export failed';
        } finally {
            setTimeout(() => {
                this._exportBtn.textContent = original;
                this._exportBtn.disabled = this.poses.poses.length < 2;
            }, 1500);
        }
    }
    _flashBtn(button, text) {
        if (!button) return;
        const original = button.textContent;
        button.textContent = text;
        setTimeout(() => {
            button.textContent = original;
        }, 1500);
    }
    _buildTrack() {
        this._track = el('div', 'mn-timeline-track');

        this._marksLayer = el('div', 'mn-timeline-marks');
        this._track.appendChild(this._marksLayer);

        this._playhead = el('div', 'mn-timeline-playhead');
        this._track.appendChild(this._playhead);

        return this._track;
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
    _refreshMarks() {
        this._marksLayer.replaceChildren();

        const poses = this.poses.poses;

        if (poses.length === 0) {
            this._marksLayer.appendChild(this._buildEmptyState());
            this._playhead.style.left = '0px';
            return;
        }

        poses.forEach((pose, index) => {
            const mark = el('div', 'mn-timeline-mark');
            mark.title = pose.name;
            mark.draggable = true;
            mark.dataset.index = index;

            const thumb = this._buildThumbnail(pose, index);
            if (thumb) mark.appendChild(thumb);

            const remove = btn('✕', (e) => {
                e.stopPropagation();
                this.poses.removePose(index);
            });
            remove.classList.add('mn-timeline-mark-remove');
            mark.appendChild(remove);

            mark.addEventListener('click', () => this.poses.goToPose(index));

            this._wireDragHandlers(mark, index);

            this._marksLayer.appendChild(mark);
        });
        this._onProgress(this._lastProgress ?? 0);
    }
    _wireDragHandlers(mark, index) {
        mark.addEventListener('dragstart', (e) => {
            // Don't start a reorder-drag when grabbing the remove button.
            if (e.target.closest('.mn-timeline-mark-remove')) {
                e.preventDefault();
                return;
            }
            this._dragFromIndex = index;
            mark.classList.add('mn-timeline-mark-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(index));
        });

        mark.addEventListener('dragend', () => {
            mark.classList.remove('mn-timeline-mark-dragging');
            this._clearDragOverIndicators();
            this._dragFromIndex = null;
        });

        mark.addEventListener('dragover', (e) => {
            if (this._dragFromIndex === null) return;
            e.preventDefault();   // required to allow a drop here
            e.dataTransfer.dropEffect = 'move';

            const rect = mark.getBoundingClientRect();
            const before = (e.clientX - rect.left) < rect.width / 2;
            this._clearDragOverIndicators();
            mark.classList.add(before ? 'mn-timeline-mark-dragover-before' : 'mn-timeline-mark-dragover-after');
            mark.dataset.dropBefore = before;
        });

        mark.addEventListener('dragleave', () => {
            mark.classList.remove('mn-timeline-mark-dragover-before', 'mn-timeline-mark-dragover-after');
        });

        mark.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = this._dragFromIndex;
            this._clearDragOverIndicators();
            if (fromIndex === null) return;

            const targetIndex = Number(mark.dataset.index);
            const before = mark.dataset.dropBefore === 'true';
            let toIndex = before ? targetIndex : targetIndex + 1;

            // Dropping past the end of the array (right half of the last
            // mark) — clamp back into range; splice would otherwise be
            // asked for an index equal to the pre-removal length.
            toIndex = Math.min(toIndex, this.poses.poses.length - 1);

            // Account for the left-shift caused by removing the dragged
            // item from earlier in the array before it's reinserted.
            if (fromIndex < toIndex) toIndex -= 1;

            this.poses.reorderPose(fromIndex, toIndex);
        });
    }
    _clearDragOverIndicators() {
        for (const mark of this._marksLayer.children) {
            mark.classList?.remove('mn-timeline-mark-dragover-before', 'mn-timeline-mark-dragover-after');
        }
    }
    _buildEmptyState() {
        const empty = el('span', 'mn-timeline-empty');
        empty.textContent = 'No poses saved yet';
        return empty;
    }
    _onProgress(progress) {
        this._lastProgress = progress;
        if (!this._playhead) return;

        const marks = this._marksLayer.children;
        if (marks.length < 2) {
            this._playhead.style.left = marks.length === 1
                ? `${marks[0].offsetLeft + marks[0].offsetWidth / 2}px`
                : '0px';
            return;
        }

        const first = marks[0];
        const last = marks[marks.length - 1];
        const firstCenter = first.offsetLeft + first.offsetWidth / 2;
        const lastCenter = last.offsetLeft + last.offsetWidth / 2;
        const clamped = Math.max(0, Math.min(1, progress));

        this._playhead.style.left = `${firstCenter + (lastCenter - firstCenter) * clamped}px`;
    }
    _onPoseStateChange({ poseCount, isPlaying, speed }) {
        this._refreshMarks();

        this._playBtn.disabled = poseCount < 2;
        this._playBtn.textContent = isPlaying ? 'Stop' : 'Play';
        this._playBtn.classList.toggle('mn-btn-playing', isPlaying);

        if (this._shareBtn) this._shareBtn.disabled = poseCount === 0;
        if (this._exportBtn) {
            const recording = Boolean(this._videoExporter?.recording);
            this._exportBtn.disabled = !this.canvas || poseCount < 2 || recording;
        }

        if (!isPlaying) {
            const pos = poseCount > 1 ? this.poses.playIndex / (poseCount - 1) : 0;
            this._onProgress(pos);
        }

        if (this._speedSlider && speed !== undefined && document.activeElement !== this._speedSlider.slider) {
            this._speedSlider.slider.value = speed;
            this._speedSlider.valueLabel.textContent = `${speed.toFixed(2)}x`;
        }
    }
}