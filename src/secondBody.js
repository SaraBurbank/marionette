import { Cloth } from './body/cloth.js';

export class SecondBodyLayer {
    constructor(world, skeleton, engine) {
        this.world    = world;
        this.skeleton = skeleton;
        this.engine   = engine;
        this._elements = [];    // list of secondary elements        
    }
    addHairStrand(boneName, segments, segmentLen, options = {}) {
        const cfg = {
            radius:      options.radius,
            mass:        options.mass,       
            frictionAir: options.frictionAir,      
            stiffness:   options.stiffness,       
            color:       options.color,
            attachAt:    options.attachAt,
            ...options,
        };

        const bone    = this.skeleton.getBone(boneName);
        const startPt = this._getBoneAttachPoint(bone, cfg.attachAt);
        const anchor = this._makeAnchor(startPt.x, startPt.y);
        const bodies = [];
        const constraints = [];

        for (let i = 0; i < segments; i++) {
            const body = Matter.Bodies.circle(
                startPt.x,
                startPt.y + (i + 1) * segmentLen,
                cfg.radius,
                {
                    mass:        cfg.mass,
                    frictionAir: cfg.frictionAir,
                    friction:    0.1,
                    restitution: 0.1,
                    collisionFilter: { mask: 0 }, // no collisions with skeleton
                    render: {
                        fillStyle:   cfg.color,
                        strokeStyle: cfg.color,
                        lineWidth:   1,
                    }
                }
            );
            console.log(bodies.body)
            bodies.push(body);

            // constrain between this and previous segment
            const bodyA = i === 0 ? anchor : bodies[i - 1];
            constraints.push(Matter.Constraint.create({
                bodyA,
                bodyB:     body,
                length:    segmentLen,
                stiffness: cfg.stiffness,
                damping:   0.05,
                render:    {
                    visible:     true,
                    strokeStyle: cfg.color,
                    lineWidth:   cfg.radius * 2,
                    anchors:     false,
                }
            }));
        }

        Matter.Composite.add(this.world, [anchor, ...bodies, ...constraints]);

        const element = { type: 'hair', boneName, anchor, bodies, constraints, cfg };
        this._elements.push(element);
        return element;
    }
    addClothingChain(boneName, segments, segmentLen, options = {}) {
        // Cloth mesh helper (segments -> rows, segmentLen -> row gap)
        const cfg = {
            columns:        Math.max(6, Math.floor(segments * 2)),
            rows:           Math.max(2, segments),
            columnGap:      options.width,
            rowGap:         segmentLen,
            particleRadius: 3,
            attachBones:    options.attachBones || [{ boneName, attachAt: options.attachAt || 'tail', offset: options.offset }],
            color:          options.color,
            strokeColor:    options.strokeColor,
            stiffness:      options.stiffness,
            mass:           options.mass,
            spreadFactor:   options.spreadFactor,
            ...options,
        };

        const attachPoints = this._resolveAttachPoints(cfg.attachBones);
        const topRowPositions = this._distributeAlongCurve(attachPoints, cfg.columns, cfg.columnGap, boneName);

        const particleOptions = {
            mass: cfg.mass,
            frictionAir: 0.06,
            collisionFilter: { mask: 0 },
            render: { visible: true, fillStyle: cfg.color, strokeStyle: cfg.strokeColor, lineWidth: 1 }
        };
        const constraintOptions = { stiffness: cfg.stiffness, render: { type: 'line', anchors: false, strokeStyle: cfg.strokeColor } };

        const cloth = Cloth(topRowPositions[0].x, topRowPositions[0].y, cfg.columns, cfg.rows, cfg.columnGap, cfg.rowGap, true, cfg.particleRadius, particleOptions, constraintOptions);

        const first = topRowPositions[0];
        const last = topRowPositions[topRowPositions.length - 1];
        const tangent = this._normalize({ x: last.x - first.x, y: last.y - first.y });
        let normal = { x: -tangent.y, y: tangent.x };
        if (normal.y < 0) {
            normal = { x: -normal.x, y: -normal.y };
        }

        for (let r = 0; r < cfg.rows; r++) {
            const rowT = cfg.rows === 1 ? 0 : r / (cfg.rows - 1);
            const rowScale = 1 + rowT * cfg.spreadFactor;
            for (let c = 0; c < cfg.columns; c++) {
                const idx = r * cfg.columns + c;
                const p = cloth.bodies[idx];
                const anchor = topRowPositions[c];
                const flareOffset = ((c - (cfg.columns - 1) * 0.5) * cfg.columnGap) * (rowScale - 1);
                const newX = anchor.x + normal.x * cfg.rowGap * r + tangent.x * flareOffset;
                const newY = anchor.y + normal.y * cfg.rowGap * r + tangent.y * flareOffset;
                Matter.Body.setPosition(p, { x: newX, y: newY });
            }
        }

        const anchors = [];
        const anchorsToCloth = [];
        for (let c = 0; c < cfg.columns; c++) {
            const particle = cloth.bodies[c];
            const anchorPos = topRowPositions[c];
            const a = this._makeAnchor(anchorPos.x, anchorPos.y);
            const con = Matter.Constraint.create({
                bodyA: a,
                pointA: { x: 0, y: 0 },
                bodyB: particle,
                pointB: { x: 0, y: 0 },
                length: 0,
                stiffness: 1,
                render: { visible: false }
            });
            anchors.push(a);
            anchorsToCloth.push(con);
        }

        Matter.Composite.add(this.world, [cloth, ...anchors, ...anchorsToCloth]);

        const element = { type: 'clothing', boneName, cloth, anchors, anchorsToCloth, cfg };
        this._elements.push(element);
        return element;
    }
    update() {
        for (const el of this._elements) {
            const bone = this.skeleton.getBone(el.boneName);
            const attachPt = this._getBoneAttachPoint(bone, el.cfg.attachAt || 'tail');

            if (el.type === 'hair') {
                // hair anchors follow single attach point
                Matter.Body.setPosition(el.anchor, { x: attachPt.x, y: attachPt.y });
                continue;
            }

            if (el.type === 'clothing') {
                const topRowPositions = this._computeClothingAnchorPositions(el);
                for (let c = 0; c < el.cfg.columns; c++) {
                    Matter.Body.setPosition(el.anchors[c], topRowPositions[c]);
                }
                continue;
            }
        }
    }
    _makeAnchor(x, y) {
        return Matter.Bodies.circle(x, y, 2, {
            isStatic: true, 
            render:   { visible: false },
            collisionFilter: { mask: 0 },
        });
    }
    _computeClothingAnchorPositions(el) {
        const attachPoints = this._resolveAttachPoints(el.cfg.attachBones);
        return this._distributeAlongCurve(attachPoints, el.cfg.columns, el.cfg.columnGap, el.boneName);
    }
    _resolveAttachPoints(specs) {
        return specs.map(spec => {
            const bone = this.skeleton.getBone(spec.boneName);
            let pt = this._getBoneAttachPoint(bone, spec.attachAt || 'tail');
            if (spec.offset) {
                pt = { x: pt.x + spec.offset.x, y: pt.y + spec.offset.y };
            }
            return pt;
        });
    }
    _distributeAlongCurve(points, count, gap, boneName) {
        if (points.length === 1) {
            const bone = this.skeleton.getBone(boneName);
            const start = points[0];
            const theta = bone.worldAngle + Math.PI * 0.5;
            const halfWidth = (count - 1) * gap * 0.5;
            return Array.from({ length: count }, (_, c) => ({
                x: start.x + Math.cos(theta) * (-halfWidth + c * gap),
                y: start.y + Math.sin(theta) * (-halfWidth + c * gap),
            }));
        }

        const segmentData = [];
        let totalLength = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy);
            segmentData.push({ a, dx, dy, len });
            totalLength += len;
        }

        if (totalLength === 0) {
            return Array.from({ length: count }, () => ({ ...points[0] }));
        }

        const positions = [];
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : i / (count - 1);
            let target = t * totalLength;
            let acc = 0;
            let segment = segmentData[segmentData.length - 1];
            for (const s of segmentData) {
                if (acc + s.len >= target || s === segmentData[segmentData.length - 1]) {
                    segment = s;
                    break;
                }
                acc += s.len;
            }
            const localT = segment.len === 0 ? 0 : (target - acc) / segment.len;
            positions.push({
                x: segment.a.x + segment.dx * localT,
                y: segment.a.y + segment.dy * localT,
            });
        }
        return positions;
    }
    _normalize(vec) {
        const mag = Math.hypot(vec.x, vec.y) || 1;
        return { x: vec.x / mag, y: vec.y / mag };
    }
    _getBoneAttachPoint(bone, attachAt = 'tail') {
        if (attachAt === 'head') {
            return { x: bone.worldX, y: bone.worldY };
        }
        return { x: bone.tailX, y: bone.tailY };
    }
    clear() {       // reset
        for (const el of this._elements) {
            if (el.type === 'hair') {
                Matter.Composite.remove(this.world, el.anchor);
                el.bodies.forEach(b => Matter.Composite.remove(this.world, b));
                el.constraints.forEach(c => Matter.Composite.remove(this.world, c));
            } else if (el.type === 'clothing') {
                Matter.Composite.remove(this.world, el.cloth);
                el.anchors.forEach(a => Matter.Composite.remove(this.world, a));
                el.anchorsToCloth.forEach(c => Matter.Composite.remove(this.world, c));
            }
        }
        this._elements = [];
    }
}