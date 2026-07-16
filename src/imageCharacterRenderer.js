export class ImageCharacterRenderer {
    constructor(skeleton, secondBodyLayer, options = {}) {
        this.skeleton        = skeleton;
        this.secondBodyLayer = secondBodyLayer;
        this.globalScale     = options.globalScale ?? 1;
        this.debug           = false;

        this.squashStretch = {
            enabled:    options.squashStretch?.enabled    ?? true,
            maxStretch: options.squashStretch?.maxStretch ?? 0.5,   // +50% length at full speed
            maxSquash:  options.squashStretch?.maxSquash  ?? 0.35,  // -35% width at full speed
            speedCap:   options.squashStretch?.speedCap   ?? 14,    // px/frame for 100% effect
        };

        this.parts = {};
        this.hair = null;

        this.drawOrder = options.drawOrder ?? [
            'L_UpperLeg', 'L_Shin', 'L_Foot',
            'L_UpperArm', 'L_Forearm', 'L_Hand',
            'Hip', 'Spine', 'Chest',
            'R_UpperLeg', 'R_Shin', 'R_Foot',
            'R_UpperArm', 'R_Forearm', 'R_Hand',
            'Neck', 'Head',
        ];
        this._leftParts = new Set([
            'L_UpperLeg', 'L_Shin', 'L_Foot',
            'L_UpperArm', 'L_Forearm', 'L_Hand',
        ]);
    }
    async loadDefaults(defaultParts = {}, pivots = {}) {
        const loads = Object.entries(defaultParts).map(([boneName, url]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.setPart(boneName, img, pivots[boneName]);
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`ImageCharacterRenderer: failed to load default for ${boneName} (${url})`);
                    resolve(); // don't block the rest of the character on one missing part
                };
                img.src = url;
            });
        });
        await Promise.all(loads);
    }
    setPart(boneName, image, pivot = {}) {
        this.parts[boneName] = {
            image,
            pivotX: pivot.pivotX ?? 0.5,
            pivotY: pivot.pivotY ?? 0.05,
            scaleX: pivot.scaleX ?? 1,
            scaleY: pivot.scaleY ?? 1,
            squashStretch: pivot.squashStretch ?? true,
 
            anchor: pivot.anchor ?? 'head',
        };
    }
    removePart(boneName) {
        delete this.parts[boneName];
    }
    setHair(image, options = {}) {
        this.hair = {
            image,
            segments: options.segments ?? 4,
            pivotX:   options.pivotX   ?? 0.5,
        };
        // Pre-slice the hair image into offscreen canvases for performance
        this._sliceHair();
    }
    removeHair() {
        this.hair        = null;
        this._hairSlices = [];
    }
    draw(ctx) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw body parts in order
        for (const boneName of this.drawOrder) {
            const part = this.parts[boneName];
            if (!part) continue;

            const bone = this._bone(boneName);
            if (!bone) continue;

            const isLeft = this._leftParts.has(boneName);
            ctx.globalAlpha = isLeft ? 0.82 : 1.0;
            this._drawPart(ctx, bone, part);
        }

        ctx.globalAlpha = 1.0;

        // Draw hair last (on top of head)
        this._drawHair(ctx);

        if (this.debug) this.skeleton.drawBones(ctx);

        ctx.restore();
    }
    _drawPart(ctx, bone, part) {
        const { image, pivotX, pivotY, scaleX, scaleY, anchor, squashStretch } = part;
        if (!image || !image.complete) return;

        // Scale image height to bone length; width scales proportionally
        const aspectRatio = image.naturalWidth / image.naturalHeight;
        let dh = bone.length * this.globalScale * scaleY;
        let dw = dh * aspectRatio * scaleX;

        const ss = this.squashStretch;
        if (ss.enabled && squashStretch) {
            const factor = Math.min(bone.velocity / ss.speedCap, 1);
            const stretchScale = 1 + factor * ss.maxStretch;
            const squashScale  = 1 - factor * ss.maxSquash;
            dh *= stretchScale;   // longer along the bone at speed
            dw *= squashScale;    // thinner across the bone at speed
        }
        
        let anchorT = 0;              // 'head'
        if (anchor === 'center') anchorT = 0.5;
        if (anchor === 'tail')   anchorT = 1.0;

        const anchorX = bone.worldX + Math.sin(bone.worldAngle) * bone.length * anchorT;
        const anchorY = bone.worldY + Math.cos(bone.worldAngle) * bone.length * anchorT;

        ctx.save();
        ctx.translate(anchorX, anchorY);
        ctx.rotate(-bone.worldAngle);

        ctx.drawImage(
            image,
            -pivotX * dw,         // x offset: pivot fraction of width
            -pivotY * dh,         // y offset: pivot fraction of height
            dw,
            dh
        );

        ctx.restore();
    }
    _sliceHair() {
        if (!this.hair) return;
        const { image, segments } = this.hair;
        if (!image.complete || !image.naturalWidth) {
            // Image not yet loaded — defer slicing
            image.onload = () => this._sliceHair();
            return;
        }

        this._hairSlices = [];
        const sliceW = image.naturalWidth  / segments;
        const sliceH = image.naturalHeight;

        for (let i = 0; i < segments; i++) {
            const offscreen   = document.createElement('canvas');
            offscreen.width   = sliceW;
            offscreen.height  = sliceH;
            const octx        = offscreen.getContext('2d');

            // Draw the i-th vertical strip of the source image onto the slice canvas
            octx.drawImage(
                image,
                i * sliceW, 0,      // source x, y
                sliceW, sliceH,     // source w, h
                0, 0,               // dest x, y
                sliceW, sliceH      // dest w, h
            );

            this._hairSlices.push(offscreen);
        }
    }
    _drawHair(ctx) {
        if (!this.hair) return;

        // Try to get physics bodies from SecondBodyLayer
        const strand = this._getHairStrand();

        if (!strand || !this._hairSlices || this._hairSlices.length === 0) {
            // Fallback: draw full hair image at head bone
            this._drawHairFallback(ctx);
            return;
        }

        const { segments, pivotX } = this.hair;
        const bodies = strand.bodies;

        // Draw each slice at its physics body's position + angle
        for (let i = 0; i < Math.min(this._hairSlices.length, bodies.length); i++) {
            const slice  = this._hairSlices[i];
            const body   = bodies[i];
            if (!slice || !body) continue;

            // Scale slice to match segment lengths
            const scaledH = (slice.naturalHeight ?? slice.height) * this.globalScale;
            const scaledW = (slice.naturalWidth  ?? slice.width)  * this.globalScale;

            ctx.save();
            ctx.translate(body.position.x, body.position.y);
            ctx.rotate(body.angle);

            // Pivot at top-center of slice
            ctx.drawImage(slice, -scaledW * pivotX, -scaledH * 0.05, scaledW, scaledH);

            ctx.restore();
        }
    }
    _drawHairFallback(ctx) {
        const head = this._bone('Head');
        if (!head || !this.hair.image.complete) return;

        const img = this.hair.image;
        const dh  = head.length * 2.4 * this.globalScale;
        const dw  = dh * (img.naturalWidth / img.naturalHeight);

        ctx.save();
        ctx.translate(head.tailX, head.tailY);
        ctx.rotate(-head.worldAngle);
        ctx.drawImage(img, -dw * this.hair.pivotX, -dh * 0.15, dw, dh);
        ctx.restore();
    }
    _getHairStrand() {
        if (!this.secondBodyLayer) return null;
        return this.secondBodyLayer._elements.find(el => el.type === 'hair') ?? null;
    }
    _bone(name) {
        try   { return this.skeleton.getBone(name); }
        catch { return null; }
    }
}