import fixWebmDuration from './fixWebmDuration.js';

export class VideoExporter {
    constructor({ canvas, poseManager }) {
        this.canvas = canvas;
        this.poses = poseManager;
        this.recording = false;
    }
    async recordSequence({ fps = 30, filename = 'animation.webm', preferredMimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] } = {}) {
        if (this.recording) {
            console.warn('VideoExporter: a recording is already in progress');
            return null;
        }
        if (!this.poses.hasPoses || this.poses.poses.length < 2) {
            console.warn('VideoExporter: need at least 2 saved poses to export');
            return null;
        }
        if (typeof MediaRecorder === 'undefined' || !this.canvas.captureStream) {
            console.warn('VideoExporter: MediaRecorder / canvas.captureStream not supported in this browser');
            return null;
        }

        const mimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
        const stream = this.canvas.captureStream(0);   // 0 = capture on change, not fixed fps
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };
        const stopped = new Promise((resolve) => {
            recorder.onstop = resolve;
        });

        const originalPingPong = this.poses.pingPong;
        this.poses.pingPong = false;

        this.recording = true;
        const startTime = Date.now();
        recorder.start(250);

        await new Promise((resolve) => {
            const unsubscribe = this.poses.onStateChange((state) => {
                if (!state.isPlaying) {
                    unsubscribe();
                    resolve();
                }
            });
            this.poses.play();
        });

        recorder.stop();
        await stopped;
        const durationMs = Date.now() - startTime;

        this.poses.pingPong = originalPingPong;
        this.recording = false;

        const rawBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
        const blob = await fixWebmDuration(rawBlob, durationMs, { logger: false });

        this._downloadBlob(blob, filename);
        return blob;
    }
    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
}