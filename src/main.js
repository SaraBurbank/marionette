import { Skeleton } from "./body/skeleton.js";
import { IKSolver } from "./IKSolver.js";
import { InputHandler } from "./inputHandler.js";
import { Cloth } from "./body/cloth.js";
import { SecondBodyLayer } from "./secondBody.js";
// import { FaceRenderer } from "./FaceRenderer.js";
import { CharacterRenderer } from "./characterRenderer.js";
import { PoseManager } from "./PoseManager.js";
import { ProportionController } from "./ProportionController.js";
import { UIController } from "./UIController.js";

/** TODO 
 *  -> Add shapes for marionette
 *  -> Facial expressions
 * UI TODO
 * -> Zoom
 * */ 

const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;
    
// engine - world (collection of bodies) simulation updates
const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 1.0;

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

// const faceRenderer = new FaceRenderer(skeleton);

const spriteUrl = new URL('./assets/marionette_sprite_template.png', import.meta.url).href;
const renderer = new CharacterRenderer(spriteUrl, skeleton);
await renderer.load();

Events.on(render, 'afterRender', () => {
    const ctx = render.context;
    skeleton.drawBones(ctx);
    renderer.draw(ctx);
    // faceRenderer.draw(ctx);
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
    fillStyle: '#c79c64',
    strokeStyle: '#5e3b1e',
    lineWidth: 2,
    visible: false,
};
const makeBone = (width, height) => Bodies.rectangle(0, 0, width, height, { render: boneStyle });

const bodyMap = {
    Spine: makeBone(30, 40),
    Chest: makeBone(50, 50),
    Neck: makeBone(16, 20),
    Head: makeBone(36, 35),
    R_Shoulder: makeBone(25, 20),
    R_UpperArm: makeBone(16, 40),
    R_Forearm: makeBone(16, 38),
    R_Hand: makeBone(18, 20),
    L_Shoulder: makeBone(25, 20),
    L_UpperArm: makeBone(16, 40),
    L_Forearm: makeBone(16, 38),
    L_Hand: makeBone(18, 20),
    R_Hip: makeBone(28, 15),
    R_UpperLeg: makeBone(18, 45),
    R_Shin: makeBone(18, 42),
    R_Foot: makeBone(22, 20),
    L_Hip: makeBone(28, 15),
    L_UpperLeg: makeBone(18, 45),
    L_Shin: makeBone(18, 42),
    L_Foot: makeBone(22, 20),
}
skeleton.attachBodies(bodyMap);

Composite.add(world, [anchorBody, ...Object.values(bodyMap)]);

// Secondary body 
const secondBody = new SecondBodyLayer(world, skeleton, engine);
 
// hair
secondBody.addHairStrand('Head', 10, 10, {
    radius:      4,
    mass:        0.2,
    frictionAir: 0.10,
    stiffness:   0.5,
    color:       '#7af4eb',
    attachAt:    'tail',
});
 
// hair volume
secondBody.addHairStrand('Head', 4, 13, {
    radius:      3,
    mass:        0.12,  // lower = floatier, higher = heavier swing
    frictionAir: 0.09,  // damping: higher = less swing, lower = more
    stiffness:   0.45,  // constraint stiffness: higher = less stretch
    color:       '#4a3020',
    attachAt:    'tail',
});
 
// clothing - shirt
secondBody.addClothingChain('Chest', 3, 16, {
    columns:     25,
    width:       14,
    mass:        0.6,
    frictionAir: 0.05,
    stiffness:   0.03,
    spreadFactor:0.9,
    color:       'rgba(197, 25, 25, 0.16)',
    strokeColor: 'rgba(222, 26, 26, 0.35)',
    mask:        0,     // collisionFilter
    attachBones: [
        { boneName: 'L_Shoulder', attachAt: 'tail' },
        { boneName: 'Chest', attachAt: 'tail', offset: { x: 0, y: 12 } },
        { boneName: 'R_Shoulder', attachAt: 'tail' },
    ],
});

// clothing - Skirt
secondBody.addClothingChain('Chest', 6, 20, {
    columns:     10,
    width:       16,
    mass:        1,
    frictionAir: 1,
    stiffness:   0.45,
    spreadFactor: 0.9,
    color:       'rgba(197, 25, 25, 0.16)',
    strokeColor: 'rgba(222, 26, 26, 0.35)',
    mask:        0,     // collisionFilter
    attachBones: [
        { boneName: 'L_Hip', attachAt: 'tail' },
        { boneName: 'Chest', attachAt: 'head', offset: { x: 0, y: 12 } },
        { boneName: 'R_Hip', attachAt: 'tail' },
    ],
});

// Pose system
const poses = new PoseManager(skeleton, ikSolver, {
    duration:  1.2,     // Tween duration in seconds
    ease:      'power2.inOut',  // GSAP ease string
    pingPong:  true,    // if true, plays A→B then B→A
    holdTime:  0.3,     // Pause at each end (seconds) when pingPong
});
 
// Stop playback if the user starts dragging
const _origOnDown = input._onDown.bind(input);
input._onDown = function(e) {
    poses.onUserDrag();
    _origOnDown(e);
};
 
// Proportion controller
const proportions = new ProportionController(skeleton);
 
// UI
const ui = new UIController({
    poseManager:          poses,
    proportionController: proportions,
    inputHandler:         input,
});
ui.mount();    // injects panel into document.body

// runner - engine update loop
const runner = Runner.create();
Runner.run(runner, engine);

// animation and logic loop
function loop() {
    ikSolver.solve() // writes corrected local angles onto active chain
    skeleton.update();
    skeleton.syncBodiesToBones(); // FK drives Matter.js bodies
    secondBody.update();
    // faceRenderer.update();
    ui.update();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);