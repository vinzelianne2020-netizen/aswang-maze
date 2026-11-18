export class GameInput {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();

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
        this.mouseMove = (this.mouseMove || 0) + event.movementX;
      }
    });
  }

  consumeMouseMove() {
    const movement = this.mouseMove || 0;
    this.mouseMove = 0;
    return movement;
  }

  isDown(...names) {
    return names.some((name) => this.keys.has(name));
  }
}
