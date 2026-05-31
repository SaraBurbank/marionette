import { Skeleton } from "./body/skeleton.js";
import { IKSolver } from "./IKSolver.js";
import { InputHandler } from "./inputHandler.js";
import { Cloth } from "./body/cloth.js";
import { SecondBodyLayer } from "./secondBody.js";

/** TODO 
 * -> fix constraints for hip (cannot bend to the left side)
 *
 * UI TODO
 * -> add button for reset pose
 * -> Zoom
 * */ 

const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;
    
// engine - world (collection of bodies) simulation updates
const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0;

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

// Creating the puppet's skeleton 
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
        R_Hip: { min: -1.2, max: 1.0 },
        R_UpperLeg: { min: -1.0, max: 0.8 },
        R_Shin: { min: -2.0, max: -0.1 },
    }),
    lFoot: ikSolver.addTarget('L_Foot', 'L_Hip', {
        L_Hip: { min: -1.0, max: 1.2 },
        L_UpperLeg: { min: -0.8, max: 1.0 },
        L_Shin: { min: 0.1, max: 2.0 },
    }),
    head: ikSolver.addTarget('Head', 'Neck', {
        Neck: { min: -0.35, max: 0.35 },
        Head: { min: -0.6, max: 0.6 },
    }),
};
const input = new InputHandler(render.canvas, skeleton, ikSolver); // mouse controls
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
    visible: false,
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

const cloth = Cloth(200, 247.5, 6, 12, 5, 5, false, 8);
Composite.add(world, [anchorBody, ...Object.values(bodyMap), cloth]);

// Secondary body 
const secondBody = new SecondBodyLayer(world, skeleton, engine);
 
// hair
secondBody.addHairStrand('Head', 5, 12, {
    radius:      4,
    mass:        0.15,
    frictionAir: 0.10,
    stiffness:   0.5,
    color:       '#7af4eb',
    attachAt:    'tail',
});
 
// // hair volume
// secondBody.addHairStrand('Head', 4, 13, {
//     radius:      3,
//     mass:        0.12,
//     frictionAir: 0.09,
//     stiffness:   0.45,
//     color:       '#4a3020',
//     attachAt:    'tail',
// });
 
// // clothing - shirt
// secondBody.addClothingChain('Chest', 4, 14, {
//     width:       18,
//     height:      8,
//     mass:        0.6,
//     frictionAir: 0.07,
//     stiffness:   0.35,
//     color:       'rgba(255,255,255,0.12)',
//     strokeColor: 'rgba(255,255,255,0.35)',
//     attachAt:    'tail',
// });

// runner - engine update loop
const runner = Runner.create();
Runner.run(runner, engine);

// animation and logic loop
function loop() {
    ikSolver.solve() // writes corrected local angles onto active chain
    skeleton.update();
    skeleton.syncBodiesToBones(); // FK drives Matter.js bodies
    secondBody.update();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);