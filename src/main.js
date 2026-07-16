import { Skeleton } from "./body/skeleton.js";
import { IKSolver } from "./IKSolver.js";
import { InputHandler } from "./inputHandler.js";
import { SecondBodyLayer } from "./body/secondBody.js";
import { PartUploader } from "./UI/partUploader.js";
import { PoseManager } from "./UI/poseManager.js";
import { ProportionController } from "./UI/proportionController.js";
import { UIController } from "./UI/uiController.js";
import { RendererManager } from "./renderManager.js";

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
const secondBody = new SecondBodyLayer(world, skeleton, engine);
// hair
// secondBody.addHairStrand('Head', 10, 10, {
//     radius:      4,
//     mass:        0.2,
//     frictionAir: 0.10,
//     stiffness:   0.5,
//     color:       '#7af4eb',
//     attachAt:    'tail',
// });
// secondBody.addHairStrand('Head', 4, 13, {
//     radius:      3,
//     mass:        0.12,  // lower = floatier, higher = heavier swing
//     frictionAir: 0.09,  // damping: higher = less swing, lower = more
//     stiffness:   0.45,  // constraint stiffness: higher = less stretch
//     color:       '#4a3020',
//     attachAt:    'tail',
// });
// secondBody.addClothingChain('Chest', 3, 16, {
//     columns:     25,
//     width:       14,
//     mass:        0.6,
//     frictionAir: 0.05,
//     stiffness:   0.03,
//     spreadFactor:0.9,
//     color:       'rgba(197, 25, 25, 0.16)',
//     strokeColor: 'rgba(222, 26, 26, 0.35)',
//     mask:        0,     // collisionFilter
//     attachBones: [
//         { boneName: 'L_Shoulder', attachAt: 'tail' },
//         { boneName: 'Chest', attachAt: 'tail', offset: { x: 0, y: 12 } },
//         { boneName: 'R_Shoulder', attachAt: 'tail' },
//     ],
// });
// secondBody.addClothingChain('Chest', 6, 20, {
//     columns:     10,
//     width:       16,
//     mass:        1,
//     frictionAir: 1,
//     stiffness:   0.45,
//     spreadFactor: 0.9,
//     color:       'rgba(197, 25, 25, 0.16)',
//     strokeColor: 'rgba(222, 26, 26, 0.35)',
//     mask:        0,     // collisionFilter
//     attachBones: [
//         { boneName: 'L_Hip', attachAt: 'tail' },
//         { boneName: 'Chest', attachAt: 'head', offset: { x: 0, y: 12 } },
//         { boneName: 'R_Hip', attachAt: 'tail' },
//     ],
// });

// Render Management
const rManager = new RendererManager(skeleton, secondBody);
rManager.debug = false;
const ASSET_BASE = new URL('./assets/default/', import.meta.url);
const defaultParts = {
    Head:        new URL('head.png', ASSET_BASE).href,
    Neck:        new URL('neck.png', ASSET_BASE).href,
    Chest:       new URL('torso.png', ASSET_BASE).href,
    Spine:       new URL('torso.png', ASSET_BASE).href,
    Hip:       new URL('hip.png', ASSET_BASE).href,
    R_UpperArm:  new URL('upperarm.png', ASSET_BASE).href,
    R_Forearm:   new URL('forearm.png', ASSET_BASE).href,
    R_Hand:      new URL('hand.png', ASSET_BASE).href,
    L_UpperArm:  new URL('upperarm.png', ASSET_BASE).href,
    L_Forearm:   new URL('forearm.png', ASSET_BASE).href,
    L_Hand:      new URL('hand.png', ASSET_BASE).href,
    R_UpperLeg:  new URL('upperleg.png', ASSET_BASE).href,
    R_Shin:      new URL('shin.png', ASSET_BASE).href,
    R_Foot:      new URL('foot.png', ASSET_BASE).href,
    L_UpperLeg:  new URL('upperleg.png', ASSET_BASE).href,
    L_Shin:      new URL('shin.png', ASSET_BASE).href,
    L_Foot:      new URL('foot.png', ASSET_BASE).href,
};
await rManager.init(defaultParts);

Events.on(render, 'afterRender', () => {
    rManager.draw(render.context);
});

// Part uploader — lets the user override any default part with their own image
const uploader = new PartUploader({
    renderer: rManager.imageRenderer,
});
uploader.mount();

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
const systems = [ ikSolver, skeleton, secondBody, ui ];
function loop() {
    for (const system of systems) {
        system.solve?.();
        system.update?.()
    }
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);