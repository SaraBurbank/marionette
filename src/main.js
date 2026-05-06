import { skeleton } from "./skeleton.js";

// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Mouse = Matter.Mouse,
    MouseConstraint = Matter.MouseConstraint,
    Composite = Matter.Composite
;
    
// engine - world (collection of bodies) simulation updates
const engine = Engine.create();
const world = engine.world;
// engine.gravity.y = 0;

// render - visual representation of the world as <canvas>
const render = Render.create({ 
    element: document.body, 
    engine: engine,
    options: {
        pixelRatio: "auto",
        wireframe: true,
        background: "#dbfaf4",
        wireframeBackground: "#343131", }
    });
Render.run(render);

// runner - engine update loop
const runner = Runner.create();
Runner.run(runner, engine);
        
// create ground, mouse control, and add bodies to the world
var ground = Bodies.rectangle(400, 610, 810, 60, { isStatic: true }),
    mouse = Mouse.create(render.canvas),
    mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: {
                visible: false
            }
        }
    })
;

Composite.add(world, [skeleton, ground, mouseConstraint]);

// keep the mouse in sync with rendering
render.mouse = mouse;

// fit the render viewport to the scene
Render.lookAt(render, {
    min: { x: 0, y: 0 },
    max: { x: 800, y: 600 }
});
