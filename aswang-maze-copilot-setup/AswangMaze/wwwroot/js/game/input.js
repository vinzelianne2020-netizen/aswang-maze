export class GameInput {
  constructor(canvas, controls = {}) {
    this.canvas = canvas;
    this.keys = new Set();
    this.controls = controls;
    this.mouseMoveX = 0;
    this.mouseMoveY = 0;

    window.addEventListener("keydown", (event) => {
      this.keys.add(event.key.toLowerCase());
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });

    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement === canvas) {
        this.mouseMoveX += event.movementX;
        this.mouseMoveY += event.movementY;
      }
    });
  }

  consumeMouseMove() {
    const movement = { x: this.mouseMoveX, y: this.mouseMoveY };
    this.mouseMoveX = 0;
    this.mouseMoveY = 0;
    return movement;
  }

  isDown(...names) {
    return names.some((name) => this.keys.has(name));
  }

  isActionDown(action) {
    const key = this.controls[action];
    return Boolean(key && this.keys.has(key));
  }
}
