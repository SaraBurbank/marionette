class CharacterApp {
    constructor() {
        this.initMatter();
        this.initSkeleton();
        this.initIK();
        this.initRenderers();
        this.initInput();
        this.initUI();
    }

    start() {
        Runner.run(this.runner, this.engine);
        requestAnimationFrame(this.loop.bind(this));
    }
}