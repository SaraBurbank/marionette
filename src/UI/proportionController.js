export class ProportionController {
    constructor(skeleton) {
        this.skeleton = skeleton;
        this._originalLengths = {}; // store original bone lengths
        for (const bone of skeleton.getAllBones()) {
            this._originalLengths[bone.name] = bone.length;
        }
        this._multipliers = {};     // current multiplier per group (1.0 = original)
        this._groups = {
            spine: ['Spine', 'Chest'],
            arms:  ['R_UpperArm', 'R_Forearm', 'R_Hand', 'L_UpperArm', 'L_Forearm', 'L_Hand'],
            legs:  ['R_UpperLeg', 'R_Shin', 'R_Foot', 'L_UpperLeg', 'L_Shin', 'L_Foot'],
            head:  ['Neck', 'Head'],
        };  // add custom groups via proportions.defineGroup(name, [boneNames])
        for (const group of Object.keys(this._groups)) {
            this._multipliers[group] = 1.0; // initialize multipliers to 1
        }
    }
    set(groupName, multiplier) {
        const group = this._groups[groupName];
        if (!group) {
            console.warn(`ProportionController: unknown group "${groupName}"`);
            return;
        }
        this._multipliers[groupName] = multiplier;
        this._applyGroup(groupName);
    }
    get(groupName) {
        return this._multipliers[groupName] ?? 1.0;
    }
    reset(groupName) {
        if (groupName) {
            this._multipliers[groupName] = 1.0;
            this._applyGroup(groupName);
        } else {
            for (const name of Object.keys(this._groups)) {
                this._multipliers[name] = 1.0;
                this._applyGroup(name);
            }
        }
    }
    defineGroup(name, boneNames) {
        this._groups[name] = boneNames;
        this._multipliers[name] = this._multipliers[name] ?? 1.0;
    }
    export() {
        return { ...this._multipliers };
    }
    import(data) {
        for (const [name, value] of Object.entries(data)) {
            if (this._groups[name]) {
                this._multipliers[name] = value;
                this._applyGroup(name);
            }
        }
    }
    _applyGroup(groupName) {
        const boneNames  = this._groups[groupName];
        const multiplier = this._multipliers[groupName];

        for (const name of boneNames) {
            try {
                const bone = this.skeleton.getBone(name);
                bone.length = this._originalLengths[name] * multiplier;
            } catch { /* bone not in skeleton, skip */ }
        }
    }
}