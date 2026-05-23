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

const { Engine, Render, Runner, Bodies, Composite } = Matter;
    
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

// IK chains
const ikSolver = new IKSolver(skeleton);
const ikTargets = {
    rHand: ikSolver.addTarget('R_Hand', 'R_Shoulder', {
        R_Forearm: { min: 0, max: Math.PI * 0.9 },
    }),
    lHand: ikSolver.addTarget('L_Hand', 'L_Shoulder', {
        L_Forearm: { min: -Math.PI * 0.9, max: 0 },
    }),
    rFoot: ikSolver.addTarget('R_Foot', 'R_Hip', {
        R_Shin: { min: -Math.PI * 0.85, max: 0 },
    }),
    lFoot: ikSolver.addTarget('L_Foot', 'L_Hip', {
        L_Shin: { min: 0, max: Math.PI * 0.85 },
    }),
    head: ikSolver.addTarget('Head', 'Neck', {
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

const bodyMap = {
    Spine: Bodies.rectangle(0, 0, 40, 40),
    Chest: Bodies.rectangle(0, 0, 50, 50),
    Neck: Bodies.rectangle(0, 0, 20, 20),
    Head: Bodies.rectangle(0, 0, 35, 35),
    R_Shoulder: Bodies.rectangle(0, 0, 25, 20),
    R_UpperArm: Bodies.rectangle(0, 0, 25, 40),
    R_Forearm: Bodies.rectangle(0, 0, 25, 38),
    R_Hand: Bodies.rectangle(0, 0, 25, 20),
    L_Shoulder: Bodies.rectangle(0, 0, 25, 20),
    L_UpperArm: Bodies.rectangle(0, 0, 25, 40),
    L_Forearm: Bodies.rectangle(0, 0, 25, 38),
    L_Hand: Bodies.rectangle(0, 0, 25, 20),
    R_Hip: Bodies.rectangle(0, 0, 25, 15),
    R_UpperLeg: Bodies.rectangle(0, 0, 25, 45),
    R_Shin: Bodies.rectangle(0, 0, 25, 42),
    R_Foot: Bodies.rectangle(0, 0, 25, 20),
    L_Hip: Bodies.rectangle(0, 0, 25, 15),
    L_UpperLeg: Bodies.rectangle(0, 0, 25, 45),
    L_Shin: Bodies.rectangle(0, 0, 25, 42),
    L_Foot: Bodies.rectangle(0, 0, 25, 20) 
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