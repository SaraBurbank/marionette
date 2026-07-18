import { Skeleton } from "./body/skeleton.js";
import { IKSolver } from "./logic/IKSolver.js";
import { InputHandler } from "./logic/inputHandler.js";
import { SecondBodyLayer } from "./body/secondBody.js";
import { PartUploader } from "./UI/partUploader.js";
import { PoseManager } from "./UI/poseManager.js";
import { ProportionController } from "./UI/proportionController.js";
import { UIController } from "./UI/uiController.js";
import { RendererManager } from "./renderManager.js";
import { TimelineBar } from "./UI/timelineBar.js";
import { PartVisibility } from "./partVisibility.js";

const { Engine, Render, Runner, Events } = Matter;
// Engine - world (collection of bodies) simulation updates
const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 1.0;

// Render - visual representation of the world as <canvas>
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

// Creating the skeleton 
const skeleton = new Skeleton(window.innerWidth / 2, window.innerHeight / 2);
skeleton.update();

// Secondary bodies
const secondBody = new SecondBodyLayer(world, skeleton, engine, Matter);
const hairStrands = [
    { x: -11, segments: 9,  stiffness: 0.55 },
    { x: -9,  segments: 8,  stiffness: 0.52 },
    { x: -7,  segments: 10, stiffness: 0.50 },
    { x: -5,  segments: 10, stiffness: 0.48 },
    { x: -2,  segments: 11, stiffness: 0.46 },
    { x: 0,   segments: 11, stiffness: 0.45 },
    { x: 2,   segments: 11, stiffness: 0.46 },
    { x: 5,   segments: 10, stiffness: 0.48 },
    { x: 7,   segments: 10, stiffness: 0.50 },
    { x: 9,   segments: 8,  stiffness: 0.52 },
    { x: 11,  segments: 9,  stiffness: 0.55 },
];
for (const strand of hairStrands) {
    secondBody.addHairStrand('Head', strand.segments, 10, {
        radius:      4,
        mass:        0.2,
        frictionAir: 0.10,
        stiffness:   strand.stiffness,
        color:       '#7af4eb',
        attachAt:    'tail',
        offset:      { x: strand.x, y: 0 },
    });
}
secondBody.addClothingChain('Chest', 4, 12, {
    columns:     11,
    width:       5,
    mass:        0.6,
    frictionAir: 0.05,
    stiffness:   0.03,
    spreadFactor:0.9,
    color:       'rgba(197, 25, 25)',
    attachBones: [
        { boneName: 'Chest', attachAt: 'tail', offset: { x: 20, y: 5 } },
        { boneName: 'Chest', attachAt: 'tail', offset: { x: 0, y: 10 } },
        { boneName: 'Chest', attachAt: 'tail', offset: { x: -20, y: 5 } },
    ],
});
secondBody.addClothingChain('Hip', 6, 18, {
    columns:     20,
    width:       5,
    mass:        0.6,
    frictionAir: 0.05,
    stiffness:   0.03,
    spreadFactor:0.9,
    color:       'rgba(84, 6, 6)',
    attachBones: [
        { boneName: 'Spine', attachAt: 'center' , offset: { x: 15, y: 20 } },
        { boneName: 'Spine', attachAt: 'center' , offset: { x: -15, y: 20 } },
    ],
});

// Render Management
const visibility = new PartVisibility();
const ASSET_BASE = new URL('./assets/default/', import.meta.url);
const asset = (filename) => new URL(filename, ASSET_BASE).href;

const rManager = new RendererManager(skeleton, secondBody);
rManager.debug = false;
await rManager.init({
    Head:        asset('head_happy.png'),
    Neck:        asset('neck.png'),
    Chest:       asset('torso.png'),
    Spine:       asset('torso.png'),
    Hip:         asset('hip.png'),
    R_UpperArm:  asset('upperarm.png'),
    R_Forearm:   asset('forearm.png'),
    R_Hand:      asset('hand.png'),
    L_UpperArm:  asset('upperarm.png'),
    L_Forearm:   asset('forearm.png'),
    L_Hand:      asset('hand.png'),
    R_UpperLeg:  asset('upperleg.png'),
    R_Shin:      asset('shin.png'),
    R_Foot:      asset('foot.png'),
    L_UpperLeg:  asset('upperleg.png'),
    L_Shin:      asset('shin.png'),
    L_Foot:      asset('foot.png'),
});

Events.on(render, 'afterRender', () => {
    if (visibility.hair) secondBody.drawHair(render.context);
    rManager.drawBehindClothing(render.context);
    if (visibility.clothes) secondBody.drawClothing(render.context);
    rManager.drawFrontOfClothing(render.context);
});

// Default expression overlay
const alertFace = new Image();
alertFace.onload = () => {
    rManager.imageRenderer.setExpressionOverlay('Head', alertFace, {
        pivotX: 0.5,
        pivotY: 0.05,   // match the default Head part's pivot so they line up
        speedCap: 4,
    });
};
alertFace.onerror = () => {
    console.warn('main.js: failed to load default expression overlay (head_alert.png)');
};
alertFace.src = asset('head_alert.png');

// IK chains
const ikSolver = new IKSolver(skeleton);
const ikTargets = {
    rHand: ikSolver.addTarget('R_Hand', 'R_Shoulder'),
    lHand: ikSolver.addTarget('L_Hand', 'L_Shoulder'),
    rFoot: ikSolver.addTarget('R_Foot', 'R_Hip'),
    lFoot: ikSolver.addTarget('L_Foot', 'L_Hip'),
    head:  ikSolver.addTarget('Head', 'Neck'),
};
const input = new InputHandler(render.canvas, skeleton, ikSolver); // mouse controls
Object.entries({
    R_Hand: ikTargets.rHand,
    L_Hand: ikTargets.lHand,
    R_Foot: ikTargets.rFoot,
    L_Foot: ikTargets.lFoot,
    Head:   ikTargets.head,
}).forEach(([bone, target]) => {
    input.setEffector(bone, target);
});

// Pose system
const poses = new PoseManager(skeleton, ikSolver, {
    duration:  1.2,     // Tween duration in seconds
    ease:      'power2.inOut',  // GSAP ease string
    pingPong:  true,    // if true, plays A→B then B→A
    holdTime:  0.3,     // Pause at each end (seconds) when pingPong
});
input.onDragStart = () => poses.onUserDrag();

// Proportion controller
const proportions = new ProportionController(skeleton);
 
// UI
const ui = new UIController({
    poseManager:          poses,
    proportionController: proportions,
    inputHandler:         input,
    visibility,
});
ui.mount();    

const uploader = new PartUploader({ renderer: rManager.imageRenderer });
uploader.mount();

const timelineBar = new TimelineBar({ poseManager: poses });
timelineBar.mount();

// runner - engine update loop
const runner = Runner.create();
Runner.run(runner, engine);

// animation and logic loop
const systems = [ ikSolver, skeleton, secondBody, ui ];
function loop() {
    for (const system of systems) {
        system.solve?.();
        system.update?.()
    }
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);