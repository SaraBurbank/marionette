import { CharacterRenderer } from './characterRenderer.js';
import { SVGCharacterBridge } from './svg.js';
import { ImageCharacterRenderer } from './ImageCharacterRenderer.js';

export class RendererManager {
    constructor(skeleton, secondBodyLayer, svgElement) {
        this._procedural = new CharacterRenderer(skeleton);
        this._svg        = new SVGCharacterBridge(skeleton, svgElement);
        this._image      = new ImageCharacterRenderer(skeleton, secondBodyLayer);

        this._mode       = 'svg';   // default — change to 'procedural' if no SVG parts

        // Expose imageRenderer so PartUploader can call setPart() on it
        this.imageRenderer = this._image;
    }
    init() {
        this._svg.init();  // cache DOM part elements
    }
    setMode(mode) {
        if (!['procedural', 'svg', 'image'].includes(mode)) {
            console.warn(`RendererManager: unknown mode "${mode}"`);
            return;
        }
        this._mode = mode;

        // Show or hide the SVG overlay depending on mode
        const svgEl = this._svg.svg;
        svgEl.style.display = mode === 'svg' ? 'block' : 'none';
    }
    getMode() {
        return this._mode;
    }
    /** Call once per frame before draw() */
    update() {
        switch (this._mode) {
            case 'procedural': this._procedural.update(); break;
            case 'svg':        this._svg.update();        break;
            case 'image':      /* no per-frame update needed */ break;
        }
    }
    /** Call once per frame — no-op in svg mode */
    draw(ctx) {
        switch (this._mode) {
            case 'procedural': this._procedural.draw(ctx); break;
            case 'svg':        /* browser handles it */     break;
            case 'image':      this._image.draw(ctx);       break;
        }
    }
    /** Expose debug toggle across all renderers */
    set debug(val) {
        this._procedural.debug = val;
        this._svg.debug        = val;
    }
}