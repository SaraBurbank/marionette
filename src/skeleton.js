// module aliases
var Bodies = Matter.Bodies,
    Body = Matter.Body,
    Constraint = Matter.Constraint,
    Composite = Matter.Composite;

var skeleton = Composite.create({ label: 'Skeleton' });

var group = Body.nextGroup(true);
var head = Bodies.circle(350, 50, 40, { collisionFilter: { group: group } });
var neck = Bodies.rectangle(350, 120, 20, 20, { collisionFilter: { group: group } });
var torso = Bodies.rectangle(350, 200, 50, 80, { collisionFilter: { group: group } });

Composite.add(skeleton, [head, neck, torso]);

var neckConstraint = Constraint.create({
  bodyA: head,
  pointA: { x: 0, y: 40 },
  bodyB: neck,
  pointB: { x: 0, y: -10 },
  stiffness: 0.8
});

var torsoConstraint = Constraint.create({
  bodyA: neck,
  pointA: { x: 0, y: 10 },
  bodyB: torso,
  pointB: { x: 0, y: -40 },
  stiffness: 0.8
});

export var body = Composite.add(skeleton, [neckConstraint, torsoConstraint]);