import { Skeleton } from "./body/skeleton.js";
import { IKSolver } from "./IKSolver.js";
import { InputHandler } from "./inputHandler.js";

/** TODO 
 * -> fix constraints
 * -> stretch on ik works, but the rest kind of works
 * -> improve skeleton
 * -> improve bone and body rotation on FK
 * 
 * UI TODO
 * -> add button for reset pose
 * -> improve skeleton look
 * -> Zoom
 * */ 

const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;
    
// engine - world (collection of bodies) simulation updates
const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0.3;

// render - visual representation of the world as <canvas>
const render = Render.create({ 
    element: document.body, 
    engine: engine,
    options: {
        width: window.innerWidth / 1.02,
        height: window.innerHeight / 1.04,
        pixelRatio: "auto",
        wireframes: false,
        background: "#343131", 
    }
});
Render.run(render);

// Adding bodies to screen ──────────
const skeleton = new Skeleton(window.innerWidth / 2, window.innerHeight / 2);
skeleton.update();

Events.on(render, 'afterRender', () => {
    const ctx = render.context;
    skeleton.drawBones(ctx);
});

// IK chains
const ikSolver = new IKSolver(skeleton);
const ikTargets = {
    rHand: ikSolver.addTarget('R_Hand', 'R_Shoulder', {
        R_Shoulder: { min: 0, max: Math.PI * 0.9 },
        R_UpperArm: { min: -Math.PI * 0.6, max: Math.PI * 0.6 },
        R_Forearm: { min: 0.1, max: Math.PI * 0.95 },
    }),
    lHand: ikSolver.addTarget('L_Hand', 'L_Shoulder', {
        L_Shoulder: { min: -Math.PI * 0.9, max: 0 },
        L_UpperArm: { min: -Math.PI * 0.6, max: Math.PI * 0.6 },
        L_Forearm: { min: -Math.PI * 0.95, max: -0.1 },
    }),
    rFoot: ikSolver.addTarget('R_Foot', 'R_Hip', {
        R_Hip: { min: -0.35, max: Math.PI * 0.45 },
        R_UpperLeg: { min: -Math.PI * 0.6, max: Math.PI * 0.3 },
        R_Shin: { min: -Math.PI * 0.95, max: -0.1 },
    }),
    lFoot: ikSolver.addTarget('L_Foot', 'L_Hip', {
        L_Hip: { min: -Math.PI * 0.45, max: 0.35 },
        L_UpperLeg: { min: -Math.PI * 0.3, max: Math.PI * 0.6 },
        L_Shin: { min: 0.1, max: Math.PI * 0.95 },
    }),
    head: ikSolver.addTarget('Head', 'Neck', {
        Neck: { min: -0.35, max: 0.35 },
        Head: { min: -0.6, max: 0.6 },
    }),
};

const input = new InputHandler(render.canvas, skeleton, ikSolver); // mouse controls
console.log(input)
input.setEffector('R_Hand', ikTargets.rHand);
input.setEffector('L_Hand', ikTargets.lHand);
input.setEffector('R_Foot', ikTargets.rFoot);
input.setEffector('L_Foot', ikTargets.lFoot);
input.setEffector('Head',   ikTargets.head);

// adding matter.js shapes to puppet with relationships
const anchorBody = Bodies.circle(skeleton.rootX,skeleton.rootY, 4, { // anchoring body to one place (may change it)
    isStatic: true,
    render: { visible: false },
    collisionFilter: { mask: 0}
});

const boneStyle = {
    fillStyle: 'rgba(255, 255, 255, 0.08)',
    strokeStyle: '#fffcf2',
    lineWidth: 3,
    visible: true,
};

const makeBone = (width, height) => Bodies.rectangle(0, 0, width, height, { render: boneStyle });

const bodyMap = {
    Spine: makeBone(40, 40),
    Chest: makeBone(50, 50),
    Neck: makeBone(20, 20),
    Head: makeBone(35, 35),
    R_Shoulder: makeBone(25, 20),
    R_UpperArm: makeBone(25, 40),
    R_Forearm: makeBone(25, 38),
    R_Hand: makeBone(25, 20),
    L_Shoulder: makeBone(25, 20),
    L_UpperArm: makeBone(25, 40),
    L_Forearm: makeBone(25, 38),
    L_Hand: makeBone(25, 20),
    R_Hip: makeBone(25, 15),
    R_UpperLeg: makeBone(25, 45),
    R_Shin: makeBone(25, 42),
    R_Foot: makeBone(25, 20),
    L_Hip: makeBone(25, 15),
    L_UpperLeg: makeBone(25, 45),
    L_Shin: makeBone(25, 42),
    L_Foot: makeBone(25, 20),
}

skeleton.attachBodies(bodyMap);
Composite.add(world, [anchorBody, ...Object.values(bodyMap)]);

// runner - engine update loop
const runner = Runner.create();
Runner.run(runner, engine);

// animation and logic loop
function loop() {
    ikSolver.solve() // writes corrected local angles onto active chain
    skeleton.update();
    skeleton.syncBodiesToBones(); // FK drives Matter.js bodies
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);