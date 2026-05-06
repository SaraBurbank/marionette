import { body } from "./skeleton.js";

// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite;

// engine - world (collection of bodies) simulation updates
const engine = Engine.create();
const world = engine.world;

// render - visual representation of the world as <canvas>
const render = Render.create({ 
    element: document.body, 
    engine: engine,
    options: {
    pixelRatio: "auto",
    wireframes: true,
    background: "#dbfaf4",
    wireframeBackground: "#343131", }
});

// create ground and add bodies to the world
var ground = Bodies.rectangle(400, 610, 810, 60, { isStatic: true });
Composite.add(world, [body, ground]);

Render.run(render);

// runner - engine update loop
const runner = Runner.create();
Runner.run(runner, engine);
