import { ImageCharacterRenderer } from './imageCharacterRenderer.js';

export class RendererManager {
    constructor(skeleton, secondBodyLayer) {
        this._image = new ImageCharacterRenderer(skeleton, secondBodyLayer);
        this.imageRenderer = this._image;
    }
    async init(defaultParts = {}) {
        await this._image.loadDefaults(defaultParts);
    }
    draw(ctx) {
        this._image.draw(ctx);
    }
    drawBehindClothing(ctx) {
        this._image.drawBehindClothing(ctx);
    }
    drawFrontOfClothing(ctx) {
        this._image.drawFrontOfClothing(ctx);
    }
    set debug(val) {
        this._image.debug = val;
    }
}