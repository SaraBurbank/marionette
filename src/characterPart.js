export class CharacterPart {
    constructor(image, pivotX = 0.5, pivotY = 0.5, scaleX = 1, scaleY = 1) {
        this.image = image;
        this.pivotX = pivotX;
        this.pivotY = pivotY;
        this.scaleX = scaleX;
        this.scaleY = scaleY;
    }
    get width() { return this.image?.naturalWidth ?? 0; }
    get height() { return this.image?.naturalHeight ?? 0; }
    static fromImage(file, pivotX = 0.5, pivotY = 0.5) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => resolve(new CharacterPart(image, pivotX, pivotY));
            image.onerror = () => reject(new Error(`Failed to load image from file: ${file.name}`));
            image.src = url;
        });
    }
    async toJSON() {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.image, 0, 0);
        
        return {
            dataUrl: canvas.toDataURL('image/png'),
            pivotX: this.pivotX,
            pivotY: this.pivotY,
            scaleX: this.scaleX,
            scaleY: this.scaleY
        };
    }
    static fromJSON(data) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(new CharacterPart(image, data.pivotX, data.pivotY, data.scaleX, data.scaleY));
            image.onerror = () => reject(new Error('Failed to load image from JSON data'));
            image.src = data.dataUrl;
        });
    }
}

export const DEFAULT_PIVOTS = {
    //torso
    Hip: { x: 0.5, y: 0.05 },
    Spine: { x: 0.5, y: 0.05 },
    Chest: { x: 0.5, y: 0.05 },
    //head
    Neck: { x: 0.5, y: 0.05 },
    Head: { x: 0.5, y: 0.85 },
    //R arm
    R_Shoulder: { x: 0.5, y: 0.05 },
    R_UpperArm: { x: 0.5, y: 0.05 },
    R_Forearm: { x: 0.5, y: 0.05 },
    R_Hand: { x: 0.5, y: 0.05 },
    //L arm
    L_Shoulder: { x: 0.5, y: 0.05 },
    L_UpperArm: { x: 0.5, y: 0.05 },
    L_Forearm: { x: 0.5, y: 0.05 },
    L_Hand: { x: 0.5, y: 0.05 },
    //R leg
    R_Hip: { x: 0.5, y: 0.05 },
    R_UpperLeg: { x: 0.5, y: 0.05 },
    R_Shin: { x: 0.5, y: 0.05 },
    R_Foot: { x: 0.2, y: 0.05 },
    //L leg
    L_Hip: { x: 0.5, y: 0.05 },
    L_UpperLeg: { x: 0.5, y: 0.05 },
    L_Shin: { x: 0.5, y: 0.05 },
    L_Foot: { x: 0.8, y: 0.05 },
    //hair
    Hair: { x: 0.5, y: 0.0 },
}

export class CharacterData {
    constructor() {
        this.parts = new Map();
        this.hair = {
            part: null,
            hasPhysics: false,
            segments: 4,
        };
        this.drawImage = [
            'L_UpperLeg', 'L_Shin', 'L_Foot',
            'L_UpperArm', 'L_Forearm', 'L_Hand',
            'Hip', 'Spine', 'Chest',
            'R_UpperLeg', 'R_Shin', 'R_Foot',
            'R_Shoulder', 'R_UpperArm', 'R_Forearm', 'R_Hand',
            'Neck', 'Head',
            'Hair'
        ];
    }
    static empty() {
        return new CharacterData();
    }
    setPart(boneName, part) {
        this.parts.set(boneName, part);
    }
    getPart(boneName) {
        return this.parts.get(boneName);
    }
    hasPart(boneName) {
        return this.parts.has(boneName);
    }
    get hasAnyPart() {
        return this.parts.size > 0 || this.hair.part !== null;
    }
    setHair(part, hasPhysics = false, segments = 4) {
        this.hair.part = part;
        this.hair.hasPhysics = hasPhysics;
        this.hair.segments = segments;
    }
    async serialize() {
        const obj = { parts: {}, hair: null, drawOrder: this.drawOrder };
        for (const [boneName, part] of this.parts) {
            obj.parts[boneName] = await part.toJSON();
        }
        if (this.hair.part) {
            obj.hair = { 
                part: await this.hair.part.toJSON(),
                hasPhysics: this.hair.hasPhysics,
                segments: this.hair.segments
            };
        }
        return JSON.stringify(obj);
    }
    static async deserialize(json) {
        const obj = JSON.parse(json);
        const data = new CharacterData();
        data.drawOrder = obj.drawOrder ?? data.drawOrder;
        for (const [name, partData] of Object.entries(obj.parts)) {
            data.setPart(name, await CharacterPart.fromJSON(partData));
        }
        if (obj.hair?.part) {
            const hairPart = await CharacterPart.fromJSON(obj.hair.part);
            data.setHair(hairPart, obj.hair.hasPhysics ?? false, obj.hair.segments ?? 4);
        }
        return data;
    }
}