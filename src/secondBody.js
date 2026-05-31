export class SecondBodyLayer {
    constructor(world, skeleton, engine) {
        this.world    = world;
        this.skeleton = skeleton;
        this.engine   = engine;
        this._elements = [];    // list of secondary elements        
    }
    addHairStrand(boneName, segments = 4, segmentLen = 14, options = {}) {
        const cfg = {
            radius:      4,
            mass:        0.2,       // lower = floatier, higher = heavier swing
            frictionAir: 0.12,      // damping: higher = less swing, lower = more
            stiffness:   0.6,       // constraint stiffness: higher = less stretch
            color:       '#3a2a1a',
            attachAt:    'tail',
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
    addClothingChain(boneName, segments = 5, segmentLen = 16, options = {}) {
        const cfg = {
            width:       14,
            height:      10,
            mass:        0.8,
            frictionAir: 0.08,
            stiffness:   0.4,
            color:       'rgba(255,255,255,0.15)',
            strokeColor: 'rgba(255,255,255,0.4)',
            attachAt:    'tail',
            ...options,
        };

        const bone    = this.skeleton.getBone(boneName);
        const startPt = this._getBoneAttachPoint(bone, cfg.attachAt);
        const anchor = this._makeAnchor(startPt.x, startPt.y);
        const bodies = [];
        const constraints = [];

        for (let i = 0; i < segments; i++) {
            const body = Matter.Bodies.rectangle(
                startPt.x,
                startPt.y + (i + 1) * segmentLen,
                cfg.width,
                cfg.height,
                {
                    mass:        cfg.mass,
                    frictionAir: cfg.frictionAir,
                    friction:    0.05,
                    restitution: 0.05,
                    chamfer:     { radius: 3 },
                    collisionFilter: { mask: 0 },
                    render: {
                        fillStyle:   cfg.color,
                        strokeStyle: cfg.strokeColor,
                        lineWidth:   1,
                    }
                }
            );
            bodies.push(body);

            const bodyA = i === 0 ? anchor : bodies[i - 1];
            constraints.push(Matter.Constraint.create({
                bodyA,
                bodyB:     body,
                length:    segmentLen,
                stiffness: cfg.stiffness,
                damping:   0.08,
                render:    { visible: false }
            }));
        }

        Matter.Composite.add(this.world, [anchor, ...bodies, ...constraints]);

        const element = { type: 'clothing', boneName, anchor, bodies, constraints, cfg };
        this._elements.push(element);
        return element;
    }
    update() {
        for (const el of this._elements) {
            const bone    = this.skeleton.getBone(el.boneName);
            const attachPt = this._getBoneAttachPoint(bone, el.cfg.attachAt);

            // Reposition anchor — setPosition with isStatic:true teleports it without affecting velocity, so constraints pull naturally
            Matter.Body.setPosition(el.anchor, { x: attachPt.x, y: attachPt.y });
        }
    }
    _makeAnchor(x, y) {
        return Matter.Bodies.circle(x, y, 2, {
            isStatic: true, 
            render:   { visible: false },
            collisionFilter: { mask: 0 },
        });
    }
    _getBoneAttachPoint(bone, attachAt = 'tail') {
        if (attachAt === 'head') {
            return { x: bone.worldX, y: bone.worldY };
        }
        return { x: bone.tailX, y: bone.tailY };
    }
    clear() {       // reset
        for (const el of this._elements) {
            Matter.Composite.remove(this.world, el.anchor);
            el.bodies.forEach(b => Matter.Composite.remove(this.world, b));
            el.constraints.forEach(c => Matter.Composite.remove(this.world, c));
        }
        this._elements = [];
    }
}