import { el, divider } from "./domHelpers.js"

export class PartUploader {
    constructor({ renderer, onCharacterLoad, onCharacterClear, defaultParts, defaultPivots }) {
        this.renderer         = renderer;
        this.onCharacterLoad  = onCharacterLoad  ?? (() => {});
        this.onCharacterClear = onCharacterClear ?? (() => {});

        // boneName -> default image URL / pivot, used to restore a part (or all parts)
        // back to their starting look instead of leaving the slot empty.
        this._defaultParts  = defaultParts  ?? {};
        this._defaultPivots = defaultPivots ?? {};

        this._panel          = null;
        this._uploadedCount  = 0;
        this._slotEls        = {}; // boneName -> { zone, pivotCanvas, resetBtn }
        this._groups = [
            {
                name: 'Head',
                slots: [
                    { boneName: 'Head',  label: 'Head / Face' },
                    { boneName: 'Neck',  label: 'Neck'        },
                ],
            },
            {
                name: 'Torso',
                slots: [
                    { boneName: 'Chest', label: 'Chest' },
                    { boneName: 'Spine', label: 'Hip' },
                ],
            },
            {
                name: 'Arms',
                slots: [
                    { boneName: 'R_UpperArm', label: 'R Upper Arm' },
                    { boneName: 'R_Forearm',  label: 'R Forearm'   },
                    { boneName: 'R_Hand',     label: 'R Hand'      },
                    { boneName: 'L_UpperArm', label: 'L Upper Arm' },
                    { boneName: 'L_Forearm',  label: 'L Forearm'   },
                    { boneName: 'L_Hand',     label: 'L Hand'      },
                ],
            },
            {
                name: 'Legs',
                slots: [
                    { boneName: 'R_UpperLeg', label: 'R Upper Leg' },
                    { boneName: 'R_Shin',     label: 'R Shin'      },
                    { boneName: 'R_Foot',     label: 'R Foot'      },
                    { boneName: 'L_UpperLeg', label: 'L Upper Leg' },
                    { boneName: 'L_Shin',     label: 'L Shin'      },
                    { boneName: 'L_Foot',     label: 'L Foot'      },
                ],
            },
        ];

        // Track pivot state per bone: { pivotX, pivotY }
        this._pivots = {};
        this._images = {};
    }
    mount() {
        this._panel = this._buildPanel();
        document.body.appendChild(this._panel);
    }
    _buildPanel() {
        const panel = el('div', 'pu-panel');

        // Header
        const header = el('div', 'pu-header');
        header.innerHTML = `
            <span class="pu-title">Character Parts</span>
            <span class="pu-subtitle">Upload PNG for each part</span>
        `;
        panel.appendChild(header);

        // Collapse toggle (panel can get tall)
        let collapsed = false;
        const body = el('div', 'pu-body');
        const toggleBtn = el('button', 'pu-toggle mn-btn');
        toggleBtn.textContent = '▲ Collapse';
        toggleBtn.addEventListener('click', () => {
            collapsed = !collapsed;
            body.style.display  = collapsed ? 'none' : 'flex';
            toggleBtn.textContent = collapsed ? '▼ Expand' : '▲ Collapse';
        });
        panel.appendChild(toggleBtn);

        // Body groups
        for (const group of this._groups) {
            body.appendChild(this._buildGroup(group));
            body.appendChild(divider());
        }

        // Hair section
        body.appendChild(this._buildHairSection());
        body.appendChild(divider());

        // Expression section
        body.appendChild(this._buildExpressionSection());
        body.appendChild(divider());

        // Clear all button
        const clearBtn = el('button', 'mn-btn mn-btn-full pu-clear-btn');
        clearBtn.textContent = 'Clear all parts';
        clearBtn.addEventListener('click', () => this._clearAll(clearBtn));
        body.appendChild(clearBtn);

        panel.appendChild(body);
        return panel;
    }
    _buildGroup({ name, slots }) {
        const group = el('div', 'pu-group');

        const groupLabel = el('span', 'mn-label');
        groupLabel.textContent = name;
        group.appendChild(groupLabel);

        for (const slot of slots) {
            group.appendChild(this._buildSlot(slot));
        }

        return group;
    }
    _buildUploadZone({ title, onFile }) {
        const zone = el('div', 'pu-zone');
        if (title) zone.title = title;

        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/png,image/webp,image/jpeg';
        input.style.display = 'none';
        zone.appendChild(input);
        zone._fileInput = input; // kept so _resetZone can restore it after a thumbnail wipes zone.innerHTML

        const zoneLabel = el('span', 'pu-zone-label');
        zoneLabel.textContent = '+';
        zone.appendChild(zoneLabel);

        // Click to open file browser
        zone.addEventListener('click', () => input.click());

        // Drag and drop
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('pu-zone-drag');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('pu-zone-drag'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('pu-zone-drag');
            const file = e.dataTransfer.files[0];
            if (file) onFile(file, zone);
        });

        // File input change
        input.addEventListener('change', () => {
            if (input.files[0]) onFile(input.files[0], zone);
        });

        return zone;
    }
    _buildSlot({ boneName, label: labelText }) {
        const row = el('div', 'pu-slot');

        // Label
        const lbl = el('span', 'pu-slot-label');
        lbl.textContent = labelText;
        row.appendChild(lbl);
        
        // Drop zone / file input
        const zone = this._buildUploadZone({
            title: `Upload ${labelText} image`,
            onFile: (file, zone) => this._loadFile(file, boneName, zone, pivotCanvas, resetBtn),
        });
        row.appendChild(zone);

        const pivotCanvas = document.createElement('canvas');
        pivotCanvas.className = 'pu-pivot-canvas';
        pivotCanvas.width  = 48;
        pivotCanvas.height = 48;
        pivotCanvas.title  = 'Click to set pivot point (joint origin)';
        pivotCanvas.style.display = 'none';

        // Initialize pivot to default
        this._pivots[boneName] = { pivotX: 0.5, pivotY: 0.05 };

        pivotCanvas.addEventListener('click', e => {
            const rect = pivotCanvas.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width;
            const py = (e.clientY - rect.top)  / rect.height;
            this._setPivot(boneName, px, py, pivotCanvas);
        });

        row.appendChild(pivotCanvas);

        // Reset-to-default button — hidden until this bone has a custom upload
        const resetBtn = el('button', 'pu-reset-btn');
        resetBtn.type        = 'button';
        resetBtn.textContent = 'X';
        resetBtn.title       = `Reset ${labelText} to default`;
        resetBtn.addEventListener('click', e => {
            e.stopPropagation(); // don't let the click bubble up into the zone's click-to-upload
            this._resetPart(boneName, zone, pivotCanvas, resetBtn);
        });
        row.appendChild(resetBtn);

        this._slotEls[boneName] = { zone, pivotCanvas, resetBtn };

        return row;
    }
    _buildHairSection() {
        const section = el('div', 'pu-group');

        const groupLabel = el('span', 'mn-label');
        groupLabel.textContent = 'Hair (physics)';
        section.appendChild(groupLabel);

        // Segment count control
        const segRow = el('div', 'pu-slot');
        const segLabel = el('span', 'pu-slot-label');
        segLabel.textContent = 'Strips';
        segRow.appendChild(segLabel);

        const segInput = document.createElement('input');
        segInput.type    = 'number';
        segInput.min     = '2';
        segInput.max     = '8';
        segInput.value   = '4';
        segInput.className = 'pu-seg-input';
        segInput.title   = 'Number of physics strips to slice the hair into';
        segRow.appendChild(segInput);
        section.appendChild(segRow);

        // Hair upload zone
        const hairRow = el('div', 'pu-slot');
        const hairLabel = el('span', 'pu-slot-label');
        hairLabel.textContent = 'Hair image';
        hairRow.appendChild(hairLabel);

        const zone = this._buildUploadZone({
            onFile: (file, zone) => this._loadHairFile(file, zone, parseInt(segInput.value)),
        });
        this._hairZone = zone;

        // Re-slice if segment count changes while hair is loaded
        segInput.addEventListener('change', () => {
            if (this.renderer.hair) {
                this.renderer.hair.segments = parseInt(segInput.value);
                this.renderer._sliceHair();
            }
        });

        hairRow.appendChild(zone);
        section.appendChild(hairRow);

        return section;
    }
    _buildExpressionSection() {
        const section = el('div', 'pu-group');

        const groupLabel = el('span', 'mn-label');
        groupLabel.textContent = 'Expression (movement)';
        section.appendChild(groupLabel);

        const hint = el('span', 'pu-subtitle');
        hint.textContent = 'Fades in over the head as the character speeds up';
        hint.style.fontSize = '9px';
        section.appendChild(hint);

        const row = el('div', 'pu-slot');
        const label = el('span', 'pu-slot-label');
        label.textContent = 'Alert face';
        row.appendChild(label);

        const zone = this._buildUploadZone({
            title: 'Upload an "alert/moving" face image',
            onFile: (file, zone) => this._loadExpressionFile(file, zone),
        });
        this._expressionZone = zone;

        row.appendChild(zone);
        section.appendChild(row);

        return section;
    }
    _loadFile(file, boneName, zone, pivotCanvas, resetBtn) {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const pivot = this._pivots[boneName];
            this.renderer.setPart(boneName, img, pivot);
            this._showThumbnail(zone, img, url);
            // this._drawPivotCanvas(pivotCanvas, img, pivot.pivotX, pivot.pivotY);
            console.log(pivot.pivotX)
            // pivotCanvas.style.display = 'block';

            if (resetBtn) resetBtn.style.display = 'flex';

            this._uploadedCount++;
            if (this._uploadedCount === 1) this.onCharacterLoad();
        };

        img.onerror = () => {
            console.error(`PartUploader: failed to load image for ${boneName}`);
            URL.revokeObjectURL(url);
        };

        img.src = url;
    }
    _loadHairFile(file, zone, segments) {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            this.renderer.setHair(img, { segments, pivotX: 0.5 });
            this._showThumbnail(zone, img, url);
            if (this._uploadedCount === 0) this.onCharacterLoad();
            this._uploadedCount++;
        };

        img.onerror = () => {
            console.error('PartUploader: failed to load hair image');
            URL.revokeObjectURL(url);
        };

        img.src = url;
    }
    _loadExpressionFile(file, zone) {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const headPivot = this._pivots['Head'] ?? { pivotX: 0.5, pivotY: 0.05 };
            this.renderer.setExpressionOverlay('Head', img, headPivot);
            this._showThumbnail(zone, img, url);
        };
        img.onerror = () => {
            console.error('PartUploader: failed to load expression overlay image');
            URL.revokeObjectURL(url);
        };

        img.src = url;
    }
    _setPivot(boneName, px, py, pivotCanvas) {
        this._pivots[boneName] = { pivotX: px, pivotY: py };

        // Update the renderer with the new pivot
        const part = this.renderer.parts[boneName];
        if (part) {
            part.pivotX = px;
            part.pivotY = py;
        }

        // Redraw the pivot canvas
        const img = part?.image;
        if (img) this._drawPivotCanvas(pivotCanvas, img, px, py);
    }
    _drawPivotCanvas(canvas, img, pivotX, pivotY) {
        const ctx  = canvas.getContext('2d');
        const W    = canvas.width;
        const H    = canvas.height;

        ctx.clearRect(0, 0, W, H);

        // Draw image scaled to fit
        const aspect = img.naturalWidth / img.naturalHeight;
        let dw = W, dh = H;
        if (aspect > 1) dh = W / aspect;
        else            dw = H * aspect;
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;

        ctx.drawImage(img, dx, dy, dw, dh);

        // Pivot crosshair
        const cx = dx + pivotX * dw;
        const cy = dy + pivotY * dh;

        ctx.strokeStyle = '#7af4eb';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy);
        ctx.lineTo(cx + 5, cy);
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx, cy + 5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#7af4eb';
        ctx.fill();

        // Tooltip hint
        ctx.fillStyle   = 'rgba(122,244,235,0.7)';
        ctx.font        = '6px sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillText('click to set pivot', W / 2, H - 2);
    }
    _showThumbnail(zone, img, url) {
        zone.innerHTML       = '';
        zone.style.padding   = '2px';
        zone.style.background = 'rgba(0,0,0,0.3)';

        const thumb     = document.createElement('img');
        thumb.src       = url;
        thumb.className = 'pu-thumb';
        zone.appendChild(thumb);
    }
    // Restores a zone to its empty "+" state (used when a bone has no default image to fall back to)
    _resetZone(zone) {
        zone.innerHTML        = '';
        zone.style.padding    = '';
        zone.style.background = '';

        if (zone._fileInput) zone.appendChild(zone._fileInput);

        const zoneLabel = el('span', 'pu-zone-label');
        zoneLabel.textContent = '+';
        zone.appendChild(zoneLabel);
    }
    // Resets one bone's part back to its default image (or clears it, if no default exists for it)
    _resetPart(boneName, zone, pivotCanvas, resetBtn) {
        const defaultUrl = this._defaultParts[boneName];

        if (!defaultUrl) {
            this.renderer.removePart(boneName);
            this._resetZone(zone);
            if (pivotCanvas) pivotCanvas.style.display = 'none';
            if (resetBtn)    resetBtn.style.display    = 'none';
            return;
        }

        const img = new Image();
        img.onload = () => {
            const pivot = this._defaultPivots[boneName] ?? { pivotX: 0.5, pivotY: 0.05 };
            this._pivots[boneName] = pivot;
            this.renderer.setPart(boneName, img, pivot);
            this._resetZone(zone); // character uses the default image again, but the slot itself looks empty
            if (resetBtn) resetBtn.style.display = 'none';
        };
        img.onerror = () => {
            console.warn(`PartUploader: failed to load default for ${boneName} (${defaultUrl})`);
        };
        img.src = defaultUrl;
    }
    _clearAll(clearBtn) {
        // Every body-part slot goes back to its default image (or empty, if it has none)
        for (const group of this._groups) {
            for (const { boneName } of group.slots) {
                const slotEls = this._slotEls[boneName];
                if (!slotEls) continue;
                this._resetPart(boneName, slotEls.zone, slotEls.pivotCanvas, slotEls.resetBtn);
            }
        }

        // Hair and the expression overlay have no default asset wired up yet, so they're
        // still fully cleared. Pass defaultParts.hair / a default alert-face URL through
        // the constructor and mirror the body-part logic above if you want those restored too.
        this.renderer.removeHair();
        this.renderer.removeExpressionOverlay('Head');
        if (this._hairZone)       this._resetZone(this._hairZone);
        if (this._expressionZone) this._resetZone(this._expressionZone);

        this._uploadedCount = 0;
        this.onCharacterClear();
    }
}