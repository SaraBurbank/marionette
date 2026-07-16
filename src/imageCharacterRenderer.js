/**
 * Renders an uploaded character by drawing per-part images
 * transformed to match each bone's world position and angle.
 *
 * PIPELINE:
 *   1. User uploads one PNG per body part via PartUploader.
 *   2. Each image is stored in this.parts keyed by bone name.
 *   3. Each part has a pivot (normalized 0–1) that defines which pixel
 *      in the image sits at the bone's head (joint origin).
 *   4. Every frame, draw() transforms each image to match its bone.
 *   5. Hair images are sliced into segments and each segment follows
 *      a Matter.js physics body from SecondBodyLayer.
 *
 * PIVOT CONVENTION:
 *   pivotX / pivotY are fractions of the image's width / height.
 *   pivotX=0.5, pivotY=0.0  → top-center of image sits at bone head
 *   pivotX=0.5, pivotY=1.0  → bottom-center sits at bone head
 *
 *   Default for all parts: { pivotX: 0.5, pivotY: 0.05 }
 *   This assumes the joint is near the top-center of each part image,
 *   which matches the reference character sheet style.
 *
 * HAIR PHYSICS:
 *   If a hair image is loaded AND a SecondBodyLayer hair strand exists,
 *   the hair image is sliced into N vertical strips. Each strip is
 *   rendered at the position of its corresponding physics body,
 *   inheriting that body's angle. This gives physically-simulated
 *   hair that still looks like the artist's original illustration.
 *
 * USAGE:
 *   const renderer = new ImageCharacterRenderer(skeleton, secondBodyLayer);
 *
 *   // Load a part (called by PartUploader):
 *   renderer.setPart('R_UpperArm', imageElement, { pivotX: 0.5, pivotY: 0.05 });
 *   renderer.setHair(imageElement, { segments: 4, pivotX: 0.5 });
 *
 *   // Each frame:
 *   renderer.draw(ctx);
 *
 *   // Toggle debug skeleton:
 *   renderer.debug = false;
 */

export class ImageCharacterRenderer {
    constructor(skeleton, secondBodyLayer, options = {}) {
        this.skeleton        = skeleton;
        this.secondBodyLayer = secondBodyLayer;
        this.globalScale     = options.globalScale ?? 1;
        this.debug           = false;
            
        this.parts = {};    // populated by setPart() calls from PartUploader.

        /**
         * hair: { image, segments, pivotX } | null
         * The full hair image, to be sliced into physics-driven strips.
         */
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

    // Defaults
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

    // Part registration

    /**
     * @param {number}           [pivot.pivotX=0.5]  - 0=left edge, 1=right edge
     * @param {number}           [pivot.pivotY=0.05] - 0=top edge,  1=bottom edge
     */
    setPart(boneName, image, pivot = {}) {
        this.parts[boneName] = {
            image,
            pivotX: pivot.pivotX ?? 0.5,
            pivotY: pivot.pivotY ?? 0.05,
            scaleX: pivot.scaleX ?? 1,
            scaleY: pivot.scaleY ?? 1,
        };
    }
    removePart(boneName) {
        delete this.parts[boneName];
    }

    /**
     * @param {number}           [options.segments=4]  - number of vertical strips
     * @param {number}           [options.pivotX=0.5]  - horizontal anchor (0–1)
     */
    setHair(image, options = {}) {
        this.hair = {
            image,
            segments: options.segments ?? 4,
            pivotX:   options.pivotX   ?? 0.5,
        };
        // Pre-slice the hair image into offscreen canvases for performance
        this._sliceHair();
    }

    /** Remove hair image. */
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

    // Part rendering

    /**
     * Draw one body part image transformed to its bone.
     *
     * TRANSFORM LOGIC:
     *   1. Translate to bone.worldX / bone.worldY (the bone's head — joint origin)
     *   2. Rotate by bone.worldAngle
     *      Our angle convention: 0 = pointing down (+Y), clockwise positive.
     *      Canvas rotate() is also clockwise, but measures from +X.
     *      Our angle is already the correct canvas rotation because:
     *        sin/cos in tailX/tailY use sin(angle) for X, cos(angle) for Y —
     *        which maps angle=0 to pointing down, matching Canvas when we just
     *        use rotate(bone.worldAngle) directly.
     *   3. Offset by -pivotX * scaledW, -pivotY * scaledH so the pivot pixel
     *      lands exactly at the bone head.
     *
     * The image is scaled so its height matches bone.length (the natural
     * "fit to bone" behaviour). Width scales proportionally.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Bone}   bone
     * @param {object} part  - { image, pivotX, pivotY, scaleX, scaleY }
     */
    _drawPart(ctx, bone, part) {
        const { image, pivotX, pivotY, scaleX, scaleY } = part;
        if (!image || !image.complete) return;

        // Scale image height to bone length; width scales proportionally
        const aspectRatio = image.naturalWidth / image.naturalHeight;
        const dh = bone.length * this.globalScale * scaleY;
        const dw = dh * aspectRatio * scaleX;

        ctx.save();
        ctx.translate(bone.worldX, bone.worldY);
        ctx.rotate(bone.worldAngle);

        // Offset so pivot pixel sits at the translation origin (bone head)
        ctx.drawImage(
            image,
            -pivotX * dw,         // x offset: pivot fraction of width
            -pivotY * dh,         // y offset: pivot fraction of height
            dw,
            dh
        );

        ctx.restore();
    }

    // ─── Hair physics rendering ───────────────────────────────────────────────

    /**
     * Slices the hair image into N vertical strips, each drawn to an
     * offscreen canvas. Called once when setHair() is invoked.
     *
     * Each slice is the full height of the hair image but only 1/N of the width.
     * Slices are stored in this._hairSlices as HTMLCanvasElement objects.
     */
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

    /**
     * Renders the hair strips, each following a Matter.js physics body
     * from SecondBodyLayer's hair strand.
     *
     * Falls back to rendering the full hair image at the Head bone's position
     * if no physics strand exists yet (so the character still looks correct
     * before physics is set up).
     */
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
        ctx.rotate(head.worldAngle);
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