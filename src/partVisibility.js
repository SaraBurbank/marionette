export class PartVisibility {
    constructor() {
        this.hair = true;
        this.clothes = true;
        this._listeners = [];
    }
    toggleHair() {
        this.hair = !this.hair;
        this._notify();
    }
    toggleClothes() {
        this.clothes = !this.clothes;
        this._notify();
    }
    onChange(fn) {
        this._listeners.push(fn);
    }
    _notify() {
        for (const fn of this._listeners) {
            fn({ hair: this.hair, clothes: this.clothes });
        }
    }
}