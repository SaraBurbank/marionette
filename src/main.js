import Matter from 'matter-js';

// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite;

// create an engine, renderer, and ground
var engine;
var render;
var box1;

function setup () {
    createCanvas(400, 400);
    engine = Engine.create();
    render = Render.create({ element: document.body, engine: engine });
    world = engine.world;
    box1 = Bodies.rectangle(200, 200, 50, 50);
    Runner.run(engine);
    Render.run(render);
    console.log(box1);
}

function draw () {
    background(220);
    fill(255, 0, 0);
    ellipse(mouseX, mouseY, 50, 50);
}