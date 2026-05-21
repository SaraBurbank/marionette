import { Skeleton } from "./skeleton/skeleton.js";
import { InputHandler } from "./inputHandler.js";

const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint } = Matter;
    
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
        wireframeBackground: "#343131", 
    }
});
Render.run(render);

// Adding bodies to screen ──────────
const ground = Bodies.rectangle(window.innerWidth  / 2, window.innerHeight / 1.05, 810, 60, { isStatic: true }) // ground (may remove it/ edit for better UI)
const skeleton = new Skeleton(window.innerWidth / 2, window.innerHeight / 1.33); // new puppet
// adding shapes to puppet with relationships
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
console.log("skeleton: ", skeleton);

const input = new InputHandler(render.canvas, skeleton); // mouse controls
const anchorBody = Bodies.circle(skeleton.rootX,skeleton.rootY, 4, { // anchoring body to one place (may change it)
    isStatic: true,
    render: { visible: false },
    collisionFilter: { mask: 0}
});
Composite.add(world, [anchorBody, ground]);
Composite.add(world, Object.values(bodyMap));

// runner - engine update loop
const runner = Runner.create();
Runner.run(runner, engine);

// animation and logic loop
function loop() {
    skeleton.update();
    skeleton.syncBodiesToBones(); // FK drives Matter.js bodies
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);