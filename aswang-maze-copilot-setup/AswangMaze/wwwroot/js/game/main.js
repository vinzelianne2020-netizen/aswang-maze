import { ensureTestPlayer, submitRun } from "../api.js";
import { loadLevel } from "./level.js";
import { Aswang } from "./enemy.js";
import { HorrorAudio } from "./audio.js";
import { GameInput } from "./input.js";
import { createPlayer, rotatePlayer, tryMovePlayer } from "./player.js";
import { ThreeRenderer } from "./three-renderer.js";

const canvas = document.querySelector("#game-canvas");

async function initialize() {
  try {
    await ensureTestPlayer();
    const levelId = Number(
      new URLSearchParams(window.location.search).get("level") || 1
    );
    const level = await loadLevel(levelId);
    startGame(level);
  } catch (error) {
    showError(error.message);
  }
}

function showError(message) {
  const error = document.querySelector("#game-error");
  error.textContent = `Unable to load: ${message}`;
  error.hidden = false;
}

function startGame(level) {
  const player = createPlayer(level);
  const input = new GameInput(canvas);
  const horrorAudio = new HorrorAudio({ masterVolume: 0.8 });
  const renderer = new ThreeRenderer(canvas);
  renderer.buildMaze(level);
  renderer.syncPlayer(player);

  const enemies = level.spawns
    .slice(0, level.enemyCount)
    .map((spawn, index) =>
      new Aswang(level.map, spawn, level.enemySpeed, index * 0.11)
    );

  let previousTime = performance.now();
  let elapsedTime = 0;
  let fps = 0;
  let fpsFrames = 0;
  let fpsElapsed = 0;
  let footstepTimer = 0;
  let grabbed = false;
  let escaped = false;
  let runSubmitted = false;
  let keysCollected = 0;

  canvas.addEventListener("click", () => horrorAudio.unlock());
  document.querySelector("#fullscreen-button").addEventListener("click", () => {
    horrorAudio.unlock();
    document.documentElement.requestFullscreen?.().catch(() => {});
    canvas.requestPointerLock?.();
  });
  window.addEventListener("keydown", (event) => {
    horrorAudio.unlock();
  });

  function frame(currentTime) {
    const dt = Math.min((currentTime - previousTime) / 1000, 0.05);
    previousTime = currentTime;
    elapsedTime += dt;

    fpsFrames++;
    fpsElapsed += dt;
    if (fpsElapsed >= 0.5) {
      fps = Math.round(fpsFrames / fpsElapsed);
      fpsFrames = 0;
      fpsElapsed = 0;
    }

    const mouseMove = input.consumeMouseMove();
    if (mouseMove !== 0) {
      rotatePlayer(player, mouseMove * 0.0022);
    }
    if (input.isDown("arrowleft")) rotatePlayer(player, -1.35 * dt);
    if (input.isDown("arrowright")) rotatePlayer(player, 1.35 * dt);

    if (!grabbed && !escaped) {
      let forward = 0;
      let strafe = 0;
      if (input.isDown("w", "arrowup")) forward += 1;
      if (input.isDown("s", "arrowdown")) forward -= 1;
      if (input.isDown("d")) strafe += 1;
      if (input.isDown("a")) strafe -= 1;

      const length = Math.hypot(forward, strafe);
      if (length > 0) {
        forward /= length;
        strafe /= length;

        const sprinting = input.isDown("shift");
        const speed = sprinting ? 2.8 : 1.6;
        const moveX =
          (player.dirX * forward + player.dirY * -strafe) * speed * dt;
        const moveY =
          (player.dirY * forward + player.dirX * strafe) * speed * dt;

        tryMovePlayer(player, level.map, moveX, moveY);

        footstepTimer -= dt;
        if (footstepTimer <= 0) {
          horrorAudio.playFootstep(sprinting);
          footstepTimer = sprinting ? 0.28 : 0.48;
        }

        if (sprinting) {
          for (const enemy of enemies) {
            enemy.emitNoise(player.x, player.y, 6);
          }
        }
      }

      for (const key of level.keys) {
        if (
          !key.collected &&
          Math.hypot(player.x - key.x, player.y - key.y) < 0.5
        ) {
          key.collected = true;
          keysCollected++;
          horrorAudio.playTone(520, 0.18, 0.25);
          for (const enemy of enemies) {
            enemy.emitNoise(player.x, player.y, 5);
          }
        }
      }

      if (
        Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < 0.45 &&
        keysCollected >= level.keysRequired
      ) {
        escaped = true;
      }

      for (const enemy of enemies) {
        if (enemy.update(dt, player, elapsedTime)) {
          grabbed = true;
          horrorAudio.playTone(48, 0.8, 0.8);
        }
      }
    }

    if (escaped && !runSubmitted) {
      runSubmitted = true;
      submitRun(
        level.id,
        Math.floor(elapsedTime * 1000),
        keysCollected,
        true
      ).catch((error) => console.error(error.message));
    }

    let nearestDistance = Infinity;
    let chaseTension = 0;
    for (const enemy of enemies) {
      const distance = Math.hypot(
        enemy.x - player.x,
        enemy.y - player.y
      );
      nearestDistance = Math.min(nearestDistance, distance);
      if (enemy.state === "CHASE") chaseTension = 0.7;
    }
    const distanceTension =
      nearestDistance === Infinity
        ? 0
        : Math.max(0, Math.min(1, 1 - nearestDistance / 12));
    horrorAudio.update(dt, Math.max(distanceTension, chaseTension));

    renderer.syncPlayer(player);
    renderer.syncKeys(level.keys);
    renderer.syncEnemies(enemies);
    renderer.update(dt, enemies);
    renderer.render();

    updateHud(
      level,
      keysCollected,
      elapsedTime,
      fps,
      grabbed,
      escaped
    );

    requestAnimationFrame(frame);
  }

  updateHud(level, 0, 0, 0, false, false);
  requestAnimationFrame(frame);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder
    .toFixed(2)
    .padStart(5, "0")}`;
}

function updateHud(level, keysCollected, elapsedTime, fps, grabbed, escaped) {
  document.querySelector("#keys-counter").textContent =
    `Keys ${keysCollected}/${level.keysRequired}`;
  document.querySelector("#timer").textContent =
    formatTime(elapsedTime);
  document.querySelector("#fps").textContent = `FPS ${fps}`;
  document.querySelector("#exit-status").textContent =
    keysCollected >= level.keysRequired
      ? "EXIT UNLOCKED"
      : "EXIT LOCKED";
  document.querySelector("#exit-status").className =
    keysCollected >= level.keysRequired
      ? "exit-status unlocked"
      : "exit-status locked";

  const caught = document.querySelector("#caught-overlay");
  const escapedOverlay = document.querySelector("#escaped-overlay");
  caught.hidden = !grabbed;
  escapedOverlay.hidden = !escaped;
}

initialize();
