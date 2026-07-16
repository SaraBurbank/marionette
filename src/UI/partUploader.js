export class PartUploader {
    constructor({ renderer, onCharacterLoad, onCharacterClear }) {
        this.renderer         = renderer;
        this.onCharacterLoad  = onCharacterLoad  ?? (() => {});
        this.onCharacterClear = onCharacterClear ?? (() => {});

        this._panel          = null;
        this._uploadedCount  = 0;
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
        this._injectStyles();
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
    _buildSlot({ boneName, label: labelText }) {
        const row = el('div', 'pu-slot');

        // Label
        const lbl = el('span', 'pu-slot-label');
        lbl.textContent = labelText;
        row.appendChild(lbl);

        // Drop zone / file input
        const zone = el('div', 'pu-zone');
        zone.title = `Upload ${labelText} image`;

        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/png,image/webp,image/jpeg';
        input.style.display = 'none';
        zone.appendChild(input);

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
            if (file) this._loadFile(file, boneName, zone, pivotCanvas, rotateBtn);
        });

        // File input change
        input.addEventListener('change', () => {
            if (input.files[0]) this._loadFile(input.files[0], boneName, zone, pivotCanvas, rotateBtn);
        });

        row.appendChild(zone);

        // Pivot editor canvas (shown after image upload)
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

        const zone = el('div', 'pu-zone');
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/png,image/webp,image/jpeg';
        input.style.display = 'none';
        zone.appendChild(input);

        const zoneLabel = el('span', 'pu-zone-label');
        zoneLabel.textContent = '+';
        zone.appendChild(zoneLabel);

        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('pu-zone-drag'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('pu-zone-drag'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('pu-zone-drag');
            const file = e.dataTransfer.files[0];
            if (file) this._loadHairFile(file, zone, parseInt(segInput.value));
        });
        input.addEventListener('change', () => {
            if (input.files[0]) this._loadHairFile(input.files[0], zone, parseInt(segInput.value));
        });

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

        const zone = el('div', 'pu-zone');
        zone.title = 'Upload an "alert/moving" face image';

        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/png,image/webp,image/jpeg';
        input.style.display = 'none';
        zone.appendChild(input);

        const zoneLabel = el('span', 'pu-zone-label');
        zoneLabel.textContent = '+';
        zone.appendChild(zoneLabel);

        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('pu-zone-drag'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('pu-zone-drag'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('pu-zone-drag');
            const file = e.dataTransfer.files[0];
            if (file) this._loadExpressionFile(file, zone);
        });
        input.addEventListener('change', () => {
            if (input.files[0]) this._loadExpressionFile(input.files[0], zone);
        });

        row.appendChild(zone);
        section.appendChild(row);

        return section;
    }
    _loadFile(file, boneName, zone, pivotCanvas) {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const pivot = this._pivots[boneName];
            this.renderer.setPart(boneName, img, pivot);
            this._showThumbnail(zone, img, url);
            this._drawPivotCanvas(pivotCanvas, img, pivot.pivotX, pivot.pivotY);
            pivotCanvas.style.display = 'block';

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
        ctx.moveTo(cx,     cy - 5);
        ctx.lineTo(cx,     cy + 5);
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
    _clearAll(clearBtn) {
        // Remove all parts from renderer
        for (const group of this._groups) {
            for (const { boneName } of group.slots) {
                this.renderer.removePart(boneName);
            }
        }
        this.renderer.removeHair();
        this.renderer.removeExpressionOverlay('Head');

        // Reset upload count and fire callback
        this._uploadedCount = 0;
        this.onCharacterClear();

        // Rebuild panel to reset all slots
        const parent = this._panel.parentElement;
        this._panel.remove();
        this._panel = this._buildPanel();
        parent.appendChild(this._panel);
    }
    _injectStyles() {
        if (document.getElementById('pu-styles')) return;
        const style = document.createElement('style');
        style.id = 'pu-styles';
        style.textContent = `
            .pu-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 100;
                width: 220px;
                max-height: calc(100vh - 40px);
                overflow-y: auto;
                background: rgba(20, 20, 20, 0.88);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 0.5px solid rgba(255,255,255,0.12);
                border-radius: 12px;
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 12px;
                color: rgba(255,255,255,0.85);
                user-select: none;
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.15) transparent;
            }

            .pu-header {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .pu-title {
                font-size: 12px;
                font-weight: 600;
                color: rgba(255,255,255,0.9);
                letter-spacing: 0.02em;
            }

            .pu-subtitle {
                font-size: 10px;
                color: rgba(255,255,255,0.35);
            }

            .pu-toggle {
                font-size: 10px;
                padding: 4px 8px;
                width: 100%;
                text-align: center;
            }

            .pu-body {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .pu-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .pu-slot {
                display: grid;
                grid-template-columns: 72px 1fr auto;
                align-items: center;
                gap: 6px;
                min-height: 36px;
            }

            .pu-slot-label {
                font-size: 10px;
                color: rgba(255,255,255,0.55);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* Drop zone */
            .pu-zone {
                height: 34px;
                border: 0.5px dashed rgba(255,255,255,0.2);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: border-color 0.12s, background 0.12s;
                overflow: hidden;
                position: relative;
            }
            .pu-zone:hover {
                border-color: rgba(122,244,235,0.5);
                background: rgba(122,244,235,0.05);
            }
            .pu-zone-drag {
                border-color: #7af4eb;
                background: rgba(122,244,235,0.1);
            }
            .pu-zone-label {
                font-size: 16px;
                color: rgba(255,255,255,0.3);
                line-height: 1;
            }

            /* Thumbnail inside zone */
            .pu-thumb {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }

            /* Pivot canvas */
            .pu-pivot-canvas {
                width: 36px;
                height: 36px;
                border-radius: 4px;
                border: 0.5px solid rgba(122,244,235,0.3);
                cursor: crosshair;
                flex-shrink: 0;
            }

            /* Segment input */
            .pu-seg-input {
                width: 48px;
                background: rgba(255,255,255,0.07);
                border: 0.5px solid rgba(255,255,255,0.15);
                border-radius: 6px;
                color: rgba(255,255,255,0.8);
                font-size: 11px;
                padding: 4px 6px;
                text-align: center;
                outline: none;
            }
            .pu-seg-input:focus {
                border-color: rgba(122,244,235,0.5);
            }

            /* Clear button */
            .pu-clear-btn {
                margin-top: 4px;
                color: rgba(255,100,100,0.7);
                border-color: rgba(255,100,100,0.2);
            }
            .pu-clear-btn:hover:not(:disabled) {
                background: rgba(255,100,100,0.08);
                border-color: rgba(255,100,100,0.4);
                color: rgba(255,120,120,0.9);
            }

            /* Scrollbar */
            .pu-panel::-webkit-scrollbar {
                width: 3px;
            }
            .pu-panel::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.15);
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    }
}
function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
}

function divider() {
    const d = document.createElement('div');
    d.className = 'mn-divider';
    return d;
}