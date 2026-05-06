// module aliases
var Bodies = Matter.Bodies,
    Body = Matter.Body,
    Constraint = Matter.Constraint,
    Common = Matter.Common,
    Composite = Matter.Composite;

var scale = 1,
    x = 350,
    y = 200,
    options = {
              render: {
                  fillStyle: Common.choose(['#f19648', '#f5d259', '#f55a3c', '#063e7b', '#ececd1'])
              }};

var headOptions = Common.extend({
    label: 'head',
    collisionFilter: {
        group: Body.nextGroup(true)
    },
    chamfer: {
        radius: [15 * scale, 15 * scale, 15 * scale, 15 * scale]
    },
    render: {
        fillStyle: '#FFBC42'
    }
}, options);

var chestOptions = Common.extend({
    label: 'chest',
    collisionFilter: {
        group: Body.nextGroup(true)
    },
    chamfer: {
        radius: [20 * scale, 20 * scale, 26 * scale, 26 * scale]
    },
    render: {
        fillStyle: '#E0A423'
    }
}, options);

var leftArmOptions = Common.extend({
    label: 'left-arm',
    collisionFilter: {
        group: Body.nextGroup(true)
    },
    chamfer: {
        radius: 10 * scale
    },
    render: {
        fillStyle: '#FFBC42'
    }
}, options);

var leftLowerArmOptions = Common.extend({}, leftArmOptions, {
    render: {
        fillStyle: '#E59B12'
    }
});

var rightArmOptions = Common.extend({
    label: 'right-arm',
    collisionFilter: {
        group: Body.nextGroup(true)
    },
    chamfer: {
        radius: 10 * scale
    },
    render: {
        fillStyle: '#FFBC42'
    }
}, options);

var rightLowerArmOptions = Common.extend({}, rightArmOptions, {
    render: {
        fillStyle: '#E59B12'
    }
});

var leftLegOptions = Common.extend({
    label: 'left-leg',
    collisionFilter: {
        group: Body.nextGroup(true)
    },
    chamfer: {
        radius: 10 * scale
    },
    render: {
        fillStyle: '#FFBC42'
    }
}, options);

var leftLowerLegOptions = Common.extend({}, leftLegOptions, {
    render: {
        fillStyle: '#E59B12'
    }
});

var rightLegOptions = Common.extend({
    label: 'right-leg',
    collisionFilter: {
        group: Body.nextGroup(true)
    },
    chamfer: {
        radius: 10 * scale
    },
    render: {
        fillStyle: '#FFBC42'
    }
}, options);

var rightLowerLegOptions = Common.extend({}, rightLegOptions, {
    render: {
        fillStyle: '#E59B12'
    }
});

var head = Bodies.rectangle(x, y - 60 * scale, 34 * scale, 40 * scale, headOptions);
var chest = Bodies.rectangle(x, y, 55 * scale, 80 * scale, chestOptions);
var rightUpperArm = Bodies.rectangle(x + 39 * scale, y - 15 * scale, 20 * scale, 40 * scale, rightArmOptions);
var rightLowerArm = Bodies.rectangle(x + 39 * scale, y + 25 * scale, 20 * scale, 60 * scale, rightLowerArmOptions);
var leftUpperArm = Bodies.rectangle(x - 39 * scale, y - 15 * scale, 20 * scale, 40 * scale, leftArmOptions);
var leftLowerArm = Bodies.rectangle(x - 39 * scale, y + 25 * scale, 20 * scale, 60 * scale, leftLowerArmOptions);
var leftUpperLeg = Bodies.rectangle(x - 20 * scale, y + 57 * scale, 20 * scale, 40 * scale, leftLegOptions);
var leftLowerLeg = Bodies.rectangle(x - 20 * scale, y + 97 * scale, 20 * scale, 60 * scale, leftLowerLegOptions);
var rightUpperLeg = Bodies.rectangle(x + 20 * scale, y + 57 * scale, 20 * scale, 40 * scale, rightLegOptions);
var rightLowerLeg = Bodies.rectangle(x + 20 * scale, y + 97 * scale, 20 * scale, 60 * scale, rightLowerLegOptions);

var chestToRightUpperArm = Constraint.create({
    bodyA: chest,
    pointA: {
        x: 24 * scale,
        y: -23 * scale
    },
    pointB: {
        x: 0,
        y: -8 * scale
    },
    bodyB: rightUpperArm,
    stiffness: 0.6,
    render: {
        visible: false
    }
});

var chestToLeftUpperArm = Constraint.create({
    bodyA: chest,
    pointA: {
        x: -24 * scale,
        y: -23 * scale
    },
    pointB: {
        x: 0,
        y: -8 * scale
    },
    bodyB: leftUpperArm,
    stiffness: 0.6,
    render: {
        visible: false
    }
});

var chestToLeftUpperLeg = Constraint.create({
    bodyA: chest,
    pointA: {
        x: -10 * scale,
        y: 30 * scale
    },
    pointB: {
        x: 0,
        y: -10 * scale
    },
    bodyB: leftUpperLeg,
    stiffness: 0.6,
    render: {
        visible: false
    }
});

var chestToRightUpperLeg = Constraint.create({
    bodyA: chest,
    pointA: {
        x: 10 * scale,
        y: 30 * scale
    },
    pointB: {
        x: 0,
        y: -10 * scale
    },
    bodyB: rightUpperLeg,
    stiffness: 0.6,
    render: {
        visible: false
    }
});

var upperToLowerRightArm = Constraint.create({
    bodyA: rightUpperArm,
    bodyB: rightLowerArm,
    pointA: {
        x: 0,
        y: 15 * scale
    },
    pointB: {
        x: 0,
        y: -25 * scale
    },
    stiffness: 0.6,
    render: {
        visible: false
    }
});

var upperToLowerLeftArm = Constraint.create({
    bodyA: leftUpperArm,
    bodyB: leftLowerArm,
    pointA: {
        x: 0,
        y: 15 * scale
    },
    pointB: {
        x: 0,
        y: -25 * scale
    },
    stiffness: 0.6,
    render: {
        visible: false
    }
});

var upperToLowerLeftLeg = Constraint.create({
    bodyA: leftUpperLeg,
    bodyB: leftLowerLeg,
    pointA: {
        x: 0,
        y: 20 * scale
    },
    pointB: {
        x: 0,
        y: -20 * scale
    },
    stiffness: 0.6,
    render: {
        visible: false
    }
});

var upperToLowerRightLeg = Constraint.create({
    bodyA: rightUpperLeg,
    bodyB: rightLowerLeg,
    pointA: {
        x: 0,
        y: 20 * scale
    },
    pointB: {
        x: 0,
        y: -20 * scale
    },
    stiffness: 0.6,
    render: {
        visible: false
    }
});

var headContraint = Constraint.create({
    bodyA: head,
    pointA: {
        x: 0,
        y: 25 * scale
    },
    pointB: {
        x: 0,
        y: -35 * scale
    },
    bodyB: chest,
    stiffness: 0.6,
    render: {
        visible: false
    }
});

var legToLeg = Constraint.create({
    bodyA: leftLowerLeg,
    bodyB: rightLowerLeg,
    stiffness: 0.01,
    render: {
        visible: false
    }
});

export var skeleton = Composite.create({
    bodies: [
        chest, head, leftLowerArm, leftUpperArm, 
        rightLowerArm, rightUpperArm, leftLowerLeg, 
        rightLowerLeg, leftUpperLeg, rightUpperLeg
    ],
    constraints: [
        upperToLowerLeftArm, upperToLowerRightArm, chestToLeftUpperArm, 
        chestToRightUpperArm, headContraint, upperToLowerLeftLeg, 
        upperToLowerRightLeg, chestToLeftUpperLeg, chestToRightUpperLeg,
        legToLeg
    ]
});
