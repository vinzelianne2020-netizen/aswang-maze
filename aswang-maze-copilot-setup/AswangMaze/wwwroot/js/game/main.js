import { ensureTestPlayer, submitRun, getProgress } from "../api.js";
import { loadLevel } from "./level.js";
import { Aswang } from "./enemy.js";
import { HorrorAudio } from "./audio.js";
import { GameInput } from "./input.js";
import { createPlayer, rotatePlayer, tryMovePlayer } from "./player.js";
import { createMazeProps } from "./props.js";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings.js";
import { ThreeRenderer } from "./three-renderer.js";

const canvas = document.querySelector("#game-canvas");
const ITEM_PICKUP_TYPES = [
  "gun",
  "map",
  "flashlight",
  "battery",
  "ammo",
  "battery",
  "ammo",
  "battery",
  "ammo"
];
const MAGAZINE_CAPACITY = 7;
const MAX_RESERVE_AMMO = 42;
const RELOAD_DURATION = 1.65;
const exploredCells = new Set();

async function initialize() {
  try {
    await ensureTestPlayer();
    const levelId = Number(
      new URLSearchParams(window.location.search).get("level") || 1
    );
    const progress = await getProgress();
    const level = await loadLevel(levelId);
    startGame(level, progress);
  } catch (error) {
    showError(error.message);
  }
}

function showError(message) {
  const error = document.querySelector("#game-error");
  error.textContent = `Unable to load: ${message}`;
  error.hidden = false;
}

function createPickups(level) {
  const occupied = new Set();
  const reserve = (point) => occupied.add(`${Math.floor(point.x)},${Math.floor(point.y)}`);
  reserve(level.start);
  reserve(level.exit);
  for (const key of level.keys) reserve(key);
  for (const spawn of level.spawns) reserve(spawn);

  const cells = [];
  for (let y = 1; y < level.height - 1; y++) {
    for (let x = 1; x < level.width - 1; x++) {
      if (level.map[y][x] !== 0 || occupied.has(`${x},${y}`)) continue;
      const startDistance = Math.hypot(x + 0.5 - level.start.x, y + 0.5 - level.start.y);
      if (startDistance < 3.5) continue;
      const seed = (Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663)) >>> 0;
      cells.push({ x, y, seed });
    }
  }
  cells.sort((a, b) => a.seed - b.seed);

  const pickups = [];
  const used = [];
  for (const type of ITEM_PICKUP_TYPES) {
    const index = cells.findIndex((cell) =>
      used.every((other) => Math.hypot(cell.x - other.x, cell.y - other.y) >= 2.5)
    );
    if (index < 0) break;
    const [cell] = cells.splice(index, 1);
    used.push(cell);
    pickups.push({
      type,
      x: cell.x + 0.5,
      y: cell.y + 0.5,
      amount: type === "ammo" ? 14 : 1,
      collected: false
    });
  }
  return pickups;
}

function updateInventoryHud(inventory, selectedItem) {
  for (const slot of document.querySelectorAll(".item-slot")) {
    const item = slot.dataset.item;
    slot.classList.toggle("selected", item === selectedItem);
    slot.querySelector(".item-slot-count").textContent = item === "flashlight"
      ? String(inventory[item] ? 1 : 0)
      : item === "ammo"
        ? inventory.gun
          ? `${inventory.magazineAmmo}/${MAGAZINE_CAPACITY} · ${inventory.ammo}`
          : String(inventory.ammo)
        : String(inventory[item]);
    if (item === "flashlight") {
      const charge = slot.querySelector(".item-slot-charge span");
      charge.style.width = `${inventory.flashlightCharge}%`;
      const chargePercent = Math.floor(inventory.flashlightCharge);
      slot.querySelector(".item-slot-charge-label").textContent = `${chargePercent}%`;
      slot.title = `Flashlight battery: ${chargePercent}%`;
      charge.style.background = inventory.flashlightCharge < 20 ? "#e34b55" : "#e5ca66";
    }
  }
}

function drawMap(level, player, enemies, pickups) {
  const mapCanvas = document.querySelector("#map-canvas");
  if (!mapCanvas.width) {
    mapCanvas.width = level.width * 12;
    mapCanvas.height = level.height * 12;
  }
  const context = mapCanvas.getContext("2d");
  const tileSize = mapCanvas.width / level.width;
  context.fillStyle = "#09090d";
  context.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (!exploredCells.has(`${x},${y}`)) continue;
      context.fillStyle = level.map[y][x] === 1 ? "#77717b" : "#1d1b22";
      context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  if (exploredCells.has(`${Math.floor(level.exit.x)},${Math.floor(level.exit.y)}`)) {
    context.fillStyle = "#e7c451";
    context.fillRect(level.exit.x * tileSize - 2, level.exit.y * tileSize - 2, 5, 5);
  }
  for (const key of level.keys) {
    if (key.collected || !exploredCells.has(`${Math.floor(key.x)},${Math.floor(key.y)}`)) continue;
    context.fillStyle = "#62d9e8";
    context.beginPath();
    context.arc(key.x * tileSize, key.y * tileSize, tileSize * 0.32, 0, Math.PI * 2);
    context.fill();
  }
  for (const enemy of enemies) {
    if (!exploredCells.has(`${Math.floor(enemy.x)},${Math.floor(enemy.y)}`)) continue;
    context.fillStyle = "#e34b55";
    context.beginPath();
    context.arc(enemy.x * tileSize, enemy.y * tileSize, tileSize * 0.4, 0, Math.PI * 2);
    context.fill();
  }
  const pickupColors = {
    gun: "#d8d8dc",
    map: "#75d47a",
    flashlight: "#f4d45e",
    ammo: "#e7a43c",
    battery: "#62d9e8"
  };
  for (const pickup of pickups) {
    if (pickup.collected || !exploredCells.has(`${Math.floor(pickup.x)},${Math.floor(pickup.y)}`)) continue;
    context.fillStyle = pickupColors[pickup.type];
    context.fillRect(
      pickup.x * tileSize - 2,
      pickup.y * tileSize - 2,
      4,
      4
    );
  }

  context.save();
  context.translate(player.x * tileSize, player.y * tileSize);
  context.rotate(Math.atan2(player.dirY, player.dirX));
  context.fillStyle = "#fff";
  context.beginPath();
  context.moveTo(tileSize * 0.65, 0);
  context.lineTo(-tileSize * 0.4, -tileSize * 0.4);
  context.lineTo(-tileSize * 0.4, tileSize * 0.4);
  context.closePath();
  context.fill();
  context.restore();
}

function startGame(level, progress = []) {
  const settings = loadSettings();
  exploredCells.clear();
  const player = createPlayer(level);
  player.hidden = false;
  const props = createMazeProps(level);
  const collisionMap = level.map.map((row) => row.slice());
  const exitCellX = Math.floor(level.exit.x);
  const exitCellY = Math.floor(level.exit.y);
  collisionMap[exitCellY][exitCellX] = 1;
  const input = new GameInput(canvas, settings.controls);
  const horrorAudio = new HorrorAudio(settings);
  const renderer = new ThreeRenderer(canvas);
  renderer.buildMaze(level, props);
  renderer.applySettings(settings);
  renderer.syncExit(0);
  renderer.syncPlayer(player);
  const pickups = createPickups(level);
  const inventory = {
    gun: 0,
    map: 0,
    flashlight: 0,
    ammo: 0,
    magazineAmmo: 0,
    battery: 0,
    flashlightCharge: 0,
    flashlightOn: false,
    reloading: false
  };
  let selectedItem = "gun";
  renderer.setEquippedItem(selectedItem, inventory);
  let mapOpen = false;

  const enemies = level.spawns
    .slice(0, level.enemyCount)
    .map((spawn, index) =>
      new Aswang(
        collisionMap,
        spawn,
        level.enemySpeed,
        index * 0.11,
        level.fogDistance,
        props
      )
    );

  let previousTime = performance.now();
  let elapsedTime = 0;
  let fps = 0;
  let fpsFrames = 0;
  let fpsElapsed = 0;
  let footstepTimer = 0;
  let reloadTimer = 0;
  const enemyAudioStates = new Map();
  let grabbed = false;
  let escaped = false;
  let runSubmitted = false;
  let keysCollected = 0;
  let hintTimer = 0;
  let gameState = "playing";
  let settingsReturnState = "paused";
  let nearInteraction = null;
  let activeHideSpot = null;
  const tutorialSeenKey = "aswang-maze-tutorial-seen";
  const levelProgress = progress.find((entry) => entry.levelId === level.id);
  const recordElement = document.querySelector("#level-record");
  recordElement.textContent = levelProgress?.bestTimeMs
    ? `Best ${formatTime(levelProgress.bestTimeMs / 1000)} · ${levelProgress.stars}★`
    : "No record yet";
  const controlLabel = (action) =>
    settings.controls[action] === " " ? "SPACE" : settings.controls[action].toUpperCase();
  const controlsHint = () =>
    `1-5 select · ${controlLabel("interact")} interact · ${controlLabel("jump")} jump · Click fire · ${controlLabel("reload")} reload · ${controlLabel("flashlight")} light · ${controlLabel("map")} map`;
  function updateControlLabels() {
    document.querySelector("#item-hint").textContent = controlsHint();
    document.querySelector("#tutorial-controls-move").textContent =
      `${controlLabel("forward")}/${controlLabel("left")}/${controlLabel("back")}/${controlLabel("right")}`;
    document.querySelector("#tutorial-controls-sprint").textContent =
      `${controlLabel("sprint")} (noisy)`;
    document.querySelector("#tutorial-controls-jump").textContent =
      controlLabel("jump");
    document.querySelector("#tutorial-controls-interact").textContent =
      `${controlLabel("interact")}`;
    document.querySelector("#tutorial-controls-hide").textContent =
      `Move close, then ${controlLabel("interact")}`;
    document.querySelector("#tutorial-controls-light-map").textContent =
      `${controlLabel("flashlight")} / ${controlLabel("map")}`;
    document.querySelector("#tutorial-controls-reload").textContent =
      controlLabel("reload");
    document.querySelector("#tutorial-controls-pause").textContent =
      `${controlLabel("pause")}`;
    document.querySelector("#map-close-hint").textContent =
      `Press ${controlLabel("map")} or ${controlLabel("pause")} to close`;
  }
  updateControlLabels();

  document.body.classList.toggle("reduced-flashing", settings.reducedFlashing);
  const freshRun = new URLSearchParams(window.location.search).get("fresh") === "1";
  if (freshRun) {
    localStorage.removeItem(`aswang-maze-checkpoint-${level.id}`);
  } else {
    loadCheckpoint();
  }
  if (keysCollected >= level.keysRequired) {
    collisionMap[exitCellY][exitCellX] = 0;
  }
  renderer.syncExit(keysCollected, level.keysRequired);
  if (!localStorage.getItem(tutorialSeenKey)) {
    gameState = "tutorial";
    document.querySelector("#tutorial-overlay").hidden = false;
  }

  canvas.addEventListener("click", () => horrorAudio.unlock());
  document.querySelector("#fullscreen-button").addEventListener("click", () => {
    horrorAudio.unlock();
    document.documentElement.requestFullscreen?.().catch(() => {});
    canvas.requestPointerLock?.();
  });
  window.addEventListener("keydown", (event) => {
    horrorAudio.unlock();
  });

  function showItemHint(message) {
    const hint = document.querySelector("#item-hint");
    hint.textContent = message;
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      hint.textContent = controlsHint();
    }, 1800);
  }

  function checkpointKey() {
    return `aswang-maze-checkpoint-${level.id}`;
  }

  function saveCheckpoint() {
    const snapshot = {
      x: player.x,
      y: player.y,
      dirX: player.dirX,
      dirY: player.dirY,
      pitch: player.pitch,
      elapsedTime,
      keys: level.keys.map((key) => key.collected),
      pickups: pickups.map((pickup) => pickup.collected),
      inventory: { ...inventory },
      flashlightChargeInitialized: true
    };
    try {
      localStorage.setItem(checkpointKey(), JSON.stringify(snapshot));
    } catch (error) {
      console.warn("Could not save the game checkpoint.", error);
    }
  }

  function loadCheckpoint() {
    try {
      const saved = JSON.parse(localStorage.getItem(checkpointKey()) || "null");
      if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return false;
      if (level.map[Math.floor(saved.y)]?.[Math.floor(saved.x)] !== 0) return false;

      player.x = saved.x;
      player.y = saved.y;
      player.dirX = Number.isFinite(saved.dirX) ? saved.dirX : 1;
      player.dirY = Number.isFinite(saved.dirY) ? saved.dirY : 0;
      player.hidden = false;
      player.pitch = Number.isFinite(saved.pitch)
        ? Math.max(-1.35, Math.min(1.35, saved.pitch))
        : 0;
      elapsedTime = Number.isFinite(saved.elapsedTime) ? Math.max(0, saved.elapsedTime) : 0;
      keysCollected = 0;
      level.keys.forEach((key, index) => {
        key.collected = Boolean(saved.keys?.[index]);
        if (key.collected) keysCollected++;
      });
      pickups.forEach((pickup, index) => {
        pickup.collected = Boolean(saved.pickups?.[index]);
      });
      for (const item of ["gun", "map", "flashlight", "ammo", "battery"]) {
        const value = saved.inventory?.[item];
        inventory[item] = Number.isFinite(value) ? Math.max(0, value) : 0;
      }
      const savedMagazine = saved.inventory?.magazineAmmo;
      if (Number.isFinite(savedMagazine)) {
        inventory.magazineAmmo = Math.max(0, Math.min(MAGAZINE_CAPACITY, savedMagazine));
        inventory.ammo = Math.min(MAX_RESERVE_AMMO, inventory.ammo);
      } else {
        inventory.magazineAmmo = inventory.gun > 0
          ? Math.min(MAGAZINE_CAPACITY, inventory.ammo)
          : 0;
        inventory.ammo = Math.min(
          MAX_RESERVE_AMMO,
          Math.max(0, inventory.ammo - inventory.magazineAmmo)
        );
      }
      inventory.flashlightCharge = Number.isFinite(saved.inventory?.flashlightCharge)
        ? Math.max(0, Math.min(100, saved.inventory.flashlightCharge))
        : 0;
      if (inventory.flashlight > 0 && !saved.flashlightChargeInitialized) {
        inventory.flashlightCharge = 100;
      }
      inventory.flashlightOn = false;
      if (inventory.flashlightCharge <= 0) {
        replaceEmptyFlashlightBattery();
      }
      return true;
    } catch (error) {
      console.warn("Could not restore the saved game checkpoint.", error);
      return false;
    }
  }

  function applySettingsForm() {
    const fields = {
      mouseSensitivity: "#setting-sensitivity",
      brightness: "#setting-brightness",
      quality: "#setting-quality",
      masterVolume: "#setting-master-volume",
      effectsVolume: "#setting-effects-volume",
      ambienceVolume: "#setting-ambience-volume"
    };
    for (const [setting, selector] of Object.entries(fields)) {
      const field = document.querySelector(selector);
      field.value = settings[setting];
      field.addEventListener("input", () => {
        settings[setting] = setting === "quality" ? field.value : Number(field.value);
        saveSettings(settings);
        renderer.applySettings(settings);
        horrorAudio.setMasterVolume(settings.masterVolume);
        horrorAudio.setEffectsVolume(settings.effectsVolume);
        horrorAudio.setAmbienceVolume(settings.ambienceVolume);
      });
    }
    for (const [setting, selector] of [
      ["subtitles", "#setting-subtitles"],
      ["reducedFlashing", "#setting-reduced-flashing"]
    ]) {
      const field = document.querySelector(selector);
      field.checked = settings[setting];
      field.addEventListener("change", () => {
        settings[setting] = field.checked;
        document.body.classList.toggle("reduced-flashing", settings.reducedFlashing);
        saveSettings(settings);
        renderer.applySettings(settings);
      });
    }
    for (const button of document.querySelectorAll("[data-bind]")) {
      const action = button.dataset.bind;
      const formatKey = (key) => key === " " ? "Space" : key.toUpperCase();
      button.textContent = `${action}: ${formatKey(settings.controls[action])}`;
      button.addEventListener("click", () => {
        button.textContent = `${action}: press a key...`;
        const capture = (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          settings.controls[action] = event.key.toLowerCase();
          input.controls[action] = settings.controls[action];
          button.textContent = `${action}: ${formatKey(settings.controls[action])}`;
          saveSettings(settings);
          updateControlLabels();
          window.removeEventListener("keydown", capture, true);
        };
        window.addEventListener("keydown", capture, true);
      });
    }
  }

  applySettingsForm();

  function setGameState(nextState, title = "", message = "") {
    gameState = nextState;
    const overlay = document.querySelector("#game-state-overlay");
    const titleElement = document.querySelector("#game-dialog-title");
    const messageElement = document.querySelector("#game-dialog-message");
    titleElement.textContent = title;
    messageElement.textContent = message;
    overlay.hidden = !["paused", "caught", "escaped"].includes(nextState);

    document.querySelector("#resume-button").hidden = nextState !== "paused";
    document.querySelector("#retry-button").hidden = nextState !== "caught";
    document.querySelector("#restart-button").hidden = !["caught", "escaped"].includes(nextState);
    document.querySelector("#next-level-button").hidden = nextState !== "escaped";
    document.querySelector("#main-menu-button").hidden = false;
    if (nextState !== "playing") document.exitPointerLock?.();
  }

  function resumeGame() {
    gameState = "playing";
    document.querySelector("#game-state-overlay").hidden = true;
    canvas.requestPointerLock?.();
  }

  function restartFromCheckpoint() {
    grabbed = false;
    escaped = false;
    runSubmitted = false;
    mapOpen = false;
    document.querySelector("#map-overlay").hidden = true;
    loadCheckpoint();
    player.hidden = false;
    activeHideSpot = null;
    if (keysCollected >= level.keysRequired) {
      collisionMap[exitCellY][exitCellX] = 0;
    } else {
      collisionMap[exitCellY][exitCellX] = 1;
    }
    renderer.syncExit(keysCollected, level.keysRequired);
    document.querySelector("#hide-overlay").hidden = true;
    renderer.setPlayerHidden(false);
    for (const enemy of enemies) {
      const spawn = level.spawns[enemies.indexOf(enemy)];
      enemy.x = spawn.x;
      enemy.y = spawn.y;
      enemy.state = "PATROL";
      enemy.stateTime = 0;
      enemy.graceTime = 5;
      enemy.path = [];
      enemy.stunnedTime = 0;
    }
    renderer.setFlashlightEnabled(false);
    renderer.syncPlayer(player);
    updateInventoryHud(inventory, selectedItem);
    setGameState("playing");
    previousTime = performance.now();
    canvas.requestPointerLock?.();
  }

  document.querySelector("#resume-button").addEventListener("click", resumeGame);
  document.querySelector("#retry-button").addEventListener("click", restartFromCheckpoint);
  document.querySelector("#restart-button").addEventListener("click", () => {
    window.location.href = `game-test.html?level=${level.id}&fresh=1`;
  });
  document.querySelector("#main-menu-button").addEventListener("click", () => {
    window.location.href = "/index.html";
  });
  document.querySelector("#next-level-button").addEventListener("click", () => {
    window.location.href = `game-test.html?level=${level.id + 1}&fresh=1`;
  });
  document.querySelector("#settings-open-button").addEventListener("click", () => {
    settingsReturnState = gameState;
    document.querySelector("#game-state-overlay").hidden = true;
    document.querySelector("#settings-overlay").hidden = false;
  });
  document.querySelector("#settings-close-button").addEventListener("click", () => {
    document.querySelector("#settings-overlay").hidden = true;
    setGameState(
      settingsReturnState,
      settingsReturnState === "caught"
        ? "CAUGHT"
        : settingsReturnState === "escaped" ? "ESCAPED" : "PAUSED",
      settingsReturnState === "caught"
        ? "The Aswang found you. Retry from your last checkpoint or try a fresh run."
        : settingsReturnState === "escaped"
          ? `Level ${level.id} complete in ${formatTime(elapsedTime)}.`
          : "Take a breath. The maze is waiting."
    );
  });
  document.querySelector("#settings-reset-button").addEventListener("click", () => {
    Object.assign(settings, DEFAULT_SETTINGS, {
      controls: { ...DEFAULT_SETTINGS.controls }
    });
    saveSettings(settings);
    window.location.reload();
  });
  document.querySelector("#tutorial-start-button").addEventListener("click", () => {
    localStorage.setItem(tutorialSeenKey, "1");
    document.querySelector("#tutorial-overlay").hidden = true;
    canvas.requestPointerLock?.();
    gameState = "playing";
  });
  document.querySelector("#tutorial-skip-button").addEventListener("click", () => {
    localStorage.setItem(tutorialSeenKey, "1");
    document.querySelector("#tutorial-overlay").hidden = true;
    canvas.requestPointerLock?.();
    gameState = "playing";
  });

  if (!localStorage.getItem(checkpointKey())) saveCheckpoint();

  function toggleMap() {
    if (gameState !== "playing") return;
    if (!inventory.map) {
      showItemHint("Find the map first");
      return;
    }
    mapOpen = !mapOpen;
    document.querySelector("#map-overlay").hidden = !mapOpen;
    if (mapOpen) {
      document.exitPointerLock?.();
      drawMap(level, player, enemies, pickups);
    } else {
      canvas.requestPointerLock?.();
    }
  }

  function toggleFlashlight() {
    if (gameState !== "playing") return;
    if (player.hidden) {
      showItemHint("You cannot use the flashlight while hiding");
      return;
    }
    if (!inventory.flashlight) {
      showItemHint("Find a flashlight first");
      return;
    }
    const replaced = inventory.flashlightCharge <= 0 &&
      replaceEmptyFlashlightBattery();
    if (inventory.flashlightCharge <= 0) {
      inventory.flashlightOn = false;
      renderer.setFlashlightEnabled(false);
      showItemHint("Flashlight empty — no spare cells");
      return;
    }
    inventory.flashlightOn = !inventory.flashlightOn;
    renderer.setFlashlightEnabled(inventory.flashlightOn);
    showItemHint(inventory.flashlightOn
      ? replaced ? "Battery replaced · flashlight on" : "Flashlight on"
      : "Flashlight off");
  }

  function replaceEmptyFlashlightBattery() {
    if (!inventory.flashlight || inventory.flashlightCharge > 0 || inventory.battery <= 0) {
      return false;
    }
    inventory.battery--;
    inventory.flashlightCharge = 100;
    horrorAudio.playBatterySwap();
    showItemHint("Flashlight battery replaced automatically");
    updateInventoryHud(inventory, selectedItem);
    saveCheckpoint();
    return true;
  }

  function getNearbyInteraction() {
    if (player.hidden) {
      return { type: "hide", target: activeHideSpot, distance: 0 };
    }

    let nearest = null;
    let nearestDistance = 1.15;
    for (const pickup of pickups) {
      if (pickup.collected || pickup.type === "battery") continue;
      const distance = Math.hypot(player.x - pickup.x, player.y - pickup.y);
      if (distance < nearestDistance) {
        nearest = { type: "pickup", target: pickup, distance };
        nearestDistance = distance;
      }
    }
    for (const key of level.keys) {
      if (key.collected) continue;
      const distance = Math.hypot(player.x - key.x, player.y - key.y);
      if (distance < nearestDistance) {
        nearest = { type: "key", target: key, distance };
        nearestDistance = distance;
      }
    }
    for (const spot of props) {
      if (!spot.hideable) continue;
      const distance = Math.hypot(player.x - spot.x, player.y - spot.y);
      if (distance < nearestDistance) {
        nearest = { type: "hide", target: spot, distance };
        nearestDistance = distance;
      }
    }
    const exitDistance = Math.hypot(player.x - level.exit.x, player.y - level.exit.y);
    if (exitDistance < nearestDistance) {
      nearest = { type: "exit", target: level.exit, distance: exitDistance };
    }
    return nearest;
  }

  function revealMap() {
    const centerX = Math.floor(player.x);
    const centerY = Math.floor(player.y);
    const radius = 4;
    for (let y = Math.max(0, centerY - radius); y <= Math.min(level.height - 1, centerY + radius); y++) {
      for (let x = Math.max(0, centerX - radius); x <= Math.min(level.width - 1, centerX + radius); x++) {
        if (Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y) > radius) continue;
        const distance = Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y);
        const steps = Math.ceil(distance * 4);
        let visible = true;
        for (let step = 1; step < steps; step++) {
          const sampleX = Math.floor(player.x + (x + 0.5 - player.x) * step / steps);
          const sampleY = Math.floor(player.y + (y + 0.5 - player.y) * step / steps);
          if (level.map[sampleY]?.[sampleX] === 1) {
            visible = false;
            break;
          }
        }
        if (visible) exploredCells.add(`${x},${y}`);
      }
    }
  }

  function updateInteractionPrompt() {
    const prompt = document.querySelector("#interaction-prompt");
    const nearby = getNearbyInteraction();
    nearInteraction = nearby;
    if (gameState !== "playing" || mapOpen || !nearby) {
      prompt.hidden = true;
      return;
    }
    prompt.hidden = false;
    if (nearby.type === "hide") {
      prompt.textContent = player.hidden
        ? `${controlLabel("interact")} · Leave hiding spot`
        : `${controlLabel("interact")} · Hide in ${nearby.target.type}`;
    } else if (nearby.type === "pickup") {
      const label = nearby.target.type === "ammo"
        ? `${nearby.target.amount} bullets`
        : nearby.target.type;
      prompt.textContent = `${controlLabel("interact")} · Pick up ${label}`;
    } else if (nearby.type === "key") {
      prompt.textContent = `${controlLabel("interact")} · Collect key`;
    } else {
      prompt.textContent = keysCollected >= level.keysRequired
        ? `Unlocked · Walk through to escape`
        : `Exit locked · Find ${level.keysRequired - keysCollected} more key(s)`;
    }
  }

  function interact() {
    if (gameState !== "playing") return;
    const nearby = getNearbyInteraction();
    if (!nearby) {
      useSelectedItem();
      return;
    }
    if (nearby.type === "hide") {
      if (player.hidden) {
        player.hidden = false;
        activeHideSpot = null;
        document.querySelector("#hide-overlay").hidden = true;
        renderer.setPlayerHidden(false);
        showItemHint("You left the hiding spot");
      } else {
        player.hidden = true;
        activeHideSpot = nearby.target;
        inventory.flashlightOn = false;
        renderer.setFlashlightEnabled(false);
        renderer.setPlayerHidden(true);
        document.querySelector("#hide-overlay span").textContent =
          `Stay quiet · Press ${controlLabel("interact")} to leave`;
        document.querySelector("#hide-overlay").hidden = false;
        showItemHint("Hidden — stay quiet");
      }
    } else if (nearby.type === "pickup") {
      const pickup = nearby.target;
      pickup.collected = true;
      if (pickup.type === "ammo") {
        const addedAmmo = Math.min(pickup.amount, MAX_RESERVE_AMMO - inventory.ammo);
        inventory.ammo += addedAmmo;
        showItemHint(addedAmmo ? `Picked up ${addedAmmo} reserve bullets` : "Reserve ammo full");
      } else if (pickup.type === "flashlight") {
        inventory.flashlight = 1;
        inventory.flashlightCharge = 100;
        showItemHint("Picked up flashlight · battery full");
      } else if (pickup.type === "gun") {
        if (!inventory.gun) inventory.magazineAmmo = MAGAZINE_CAPACITY;
        inventory.gun = 1;
        showItemHint("Picked up gun · 7-round magazine loaded");
      } else {
        inventory[pickup.type]++;
        showItemHint(pickup.type === "battery"
          ? "Battery cell added · automatic flashlight replacement"
          : `Picked up: ${pickup.type}`);
      }
      horrorAudio.playTone(520, 0.18, 0.25);
      saveCheckpoint();
    } else if (nearby.type === "key") {
      nearby.target.collected = true;
      keysCollected++;
      showItemHint(`Key collected · ${keysCollected}/${level.keysRequired}`);
      horrorAudio.playTone(660, 0.2, 0.3);
      for (const enemy of enemies) enemy.emitNoise(player.x, player.y, 5);
      renderer.syncExit(keysCollected, level.keysRequired);
      if (keysCollected >= level.keysRequired) {
        collisionMap[exitCellY][exitCellX] = 0;
      }
      saveCheckpoint();
    } else if (keysCollected >= level.keysRequired) {
      escaped = true;
    } else {
      showItemHint(`Find ${level.keysRequired - keysCollected} more key(s)`);
    }
    updateInventoryHud(inventory, selectedItem);
  }

  function fireGun() {
    if (gameState !== "playing" || mapOpen) return;
    if (player.hidden) {
      showItemHint("You cannot fire while hiding");
      return;
    }
    if (!inventory.gun) {
      showItemHint("Find the gun first");
      return;
    }
    if (selectedItem !== "gun") {
      selectedItem = "gun";
      renderer.setEquippedItem(selectedItem, inventory);
    }
    if (inventory.reloading) return;
    if (inventory.magazineAmmo <= 0) {
      if (inventory.ammo > 0) reloadGun();
      else showItemHint("Magazine empty · no reserve bullets");
      return;
    }

    inventory.magazineAmmo--;
    const maxDistance = 9;
    let target = null;
    let targetDistance = maxDistance;
    for (const enemy of enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      const forward = dx * player.dirX + dy * player.dirY;
      const sideways = Math.abs(dx * player.dirY - dy * player.dirX);
      if (
        forward > 0 &&
        distance < targetDistance &&
        sideways < 0.38 &&
        hasClearShot(enemy.x, enemy.y)
      ) {
        target = enemy;
        targetDistance = distance;
      }
    }

    if (target) {
      target.stun(2.5);
      showItemHint("Aswang stunned — run!");
    } else {
      showItemHint("Shot fired");
    }
    for (const enemy of enemies) enemy.emitNoise(player.x, player.y, 20);
    renderer.fireViewModel(target
      ? { x: target.x, y: 0.9, z: target.y, surface: "flesh" }
      : null);
    horrorAudio.playGunshot();
    if (inventory.magazineAmmo === 0 && inventory.ammo > 0) reloadGun();
    saveCheckpoint();
  }

  function reloadGun() {
    if (gameState !== "playing" || mapOpen || !inventory.gun || inventory.reloading) return;
    if (inventory.magazineAmmo >= MAGAZINE_CAPACITY) {
      showItemHint("Magazine is full");
      return;
    }
    if (inventory.ammo <= 0) {
      showItemHint("No reserve bullets");
      return;
    }
    selectedItem = "gun";
    renderer.setEquippedItem(selectedItem, inventory);
    inventory.reloading = true;
    reloadTimer = RELOAD_DURATION;
    horrorAudio.playReload();
    showItemHint("Reloading…");
    saveCheckpoint();
  }

  function hasClearShot(targetX, targetY) {
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const steps = Math.ceil(Math.hypot(dx, dy) * 20);
    for (let step = 1; step <= steps; step++) {
      const sampleX = Math.floor(player.x + dx * step / steps);
      const sampleY = Math.floor(player.y + dy * step / steps);
      if (level.map[sampleY]?.[sampleX] !== 0) return false;
    }
    return true;
  }

  function useSelectedItem() {
    if (selectedItem === "gun") {
      fireGun();
    } else if (selectedItem === "map") {
      toggleMap();
    } else if (selectedItem === "flashlight") {
      toggleFlashlight();
    } else if (selectedItem === "battery") {
      if (!inventory.battery) {
        showItemHint("No spare battery cells");
      } else {
        showItemHint("Battery cells replace the flashlight automatically");
      }
    } else {
      showItemHint("Bullets load automatically when collected");
    }
    updateInventoryHud(inventory, selectedItem);
  }

  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === settings.controls.pause) {
      if (mapOpen) {
        mapOpen = false;
        document.querySelector("#map-overlay").hidden = true;
        canvas.requestPointerLock?.();
      } else if (gameState === "playing") {
        setGameState("paused", "PAUSED", "Take a breath. The maze is waiting.");
      } else if (gameState === "paused") {
        resumeGame();
      }
      return;
    }
    if (gameState !== "playing") return;
    if (/^[1-5]$/.test(key)) {
      selectedItem = ["gun", "map", "flashlight", "ammo", "battery"][Number(key) - 1];
      renderer.setEquippedItem(selectedItem, inventory);
      updateInventoryHud(inventory, selectedItem);
    } else if (key === settings.controls.interact) {
      event.preventDefault();
      interact();
    } else if (key === settings.controls.reload) {
      event.preventDefault();
      reloadGun();
    } else if (key === settings.controls.flashlight) {
      toggleFlashlight();
      updateInventoryHud(inventory, selectedItem);
    } else if (key === settings.controls.map) {
      toggleMap();
    } else if (key === settings.controls.jump) {
      event.preventDefault();
      if (gameState === "playing" && !mapOpen && !player.hidden &&
          player.jumpHeight === 0 && !grabbed && !escaped) {
        player.jumpVelocity = 5.2;
      }
    }
  });

  document.querySelector("#item-belt").addEventListener("click", (event) => {
    const slot = event.target.closest(".item-slot");
    if (!slot) return;
    selectedItem = slot.dataset.item;
    renderer.setEquippedItem(selectedItem, inventory);
    updateInventoryHud(inventory, selectedItem);
  });

  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || document.pointerLockElement !== canvas) return;
    fireGun();
    updateInventoryHud(inventory, selectedItem);
  });

  function frame(currentTime) {
    const dt = Math.min((currentTime - previousTime) / 1000, 0.05);
    previousTime = currentTime;
    const active = gameState === "playing" && !mapOpen;
    if (active) elapsedTime += dt;
    if (active && inventory.reloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) {
        const loaded = Math.min(
          MAGAZINE_CAPACITY - inventory.magazineAmmo,
          inventory.ammo
        );
        inventory.magazineAmmo += loaded;
        inventory.ammo -= loaded;
        inventory.reloading = false;
        renderer.finishReload();
        showItemHint(`Reloaded · ${inventory.magazineAmmo}/${MAGAZINE_CAPACITY}`);
        saveCheckpoint();
      }
    }

    fpsFrames++;
    fpsElapsed += dt;
    if (fpsElapsed >= 0.5) {
      fps = Math.round(fpsFrames / fpsElapsed);
      fpsFrames = 0;
      fpsElapsed = 0;
    }

    const mouseMove = input.consumeMouseMove();
    if (active && !player.hidden && !grabbed && !escaped &&
        (player.jumpHeight > 0 || player.jumpVelocity > 0)) {
      player.jumpHeight = Math.max(0, player.jumpHeight + player.jumpVelocity * dt);
      player.jumpVelocity -= 14 * dt;
      if (player.jumpHeight === 0) player.jumpVelocity = 0;
    }
    if (active && mouseMove.x !== 0) {
      rotatePlayer(player, mouseMove.x * 0.0022 * settings.mouseSensitivity);
    }
    if (active && mouseMove.y !== 0) {
      player.pitch = Math.max(
        -1.35,
        Math.min(1.35, player.pitch - mouseMove.y * 0.0022 * settings.mouseSensitivity)
      );
    }
    if (active && input.isDown("arrowleft")) rotatePlayer(player, -1.35 * dt);
    if (active && input.isDown("arrowright")) rotatePlayer(player, 1.35 * dt);

    let movementIntensity = 0;
    let sprinting = false;
    let strafe = 0;
    if (active && !grabbed && !escaped) {
      if (!player.hidden) {
        let forward = 0;
        if (input.isActionDown("forward") || input.isDown("arrowup")) forward += 1;
        if (input.isActionDown("back") || input.isDown("arrowdown")) forward -= 1;
        if (input.isActionDown("right")) strafe += 1;
        if (input.isActionDown("left")) strafe -= 1;

        const length = Math.hypot(forward, strafe);
        if (length > 0) {
          forward /= length;
          strafe /= length;

          sprinting = input.isActionDown("sprint");
          const speed = sprinting ? 3.7 : 2.1;
          const moveX =
            (player.dirX * forward + player.dirY * -strafe) * speed * dt;
          const moveY =
            (player.dirY * forward + player.dirX * strafe) * speed * dt;

          const previousX = player.x;
          const previousY = player.y;
          tryMovePlayer(player, collisionMap, moveX, moveY, props);
          const movedDistance = Math.hypot(player.x - previousX, player.y - previousY);
          movementIntensity = Math.min(1, movedDistance / Math.max(speed * dt, 0.001));

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

        revealMap();
        updateInteractionPrompt();
      } else {
        updateInteractionPrompt();
      }

      if (inventory.flashlightOn) {
        inventory.flashlightCharge = Math.max(0, inventory.flashlightCharge - dt * 1.5);
      }
      if (inventory.flashlight && inventory.flashlightCharge <= 0) {
        if (!replaceEmptyFlashlightBattery() && inventory.flashlightOn) {
          inventory.flashlightOn = false;
          renderer.setFlashlightEnabled(false);
          horrorAudio.playFlashlightPowerDown();
          showItemHint("Flashlight empty · no spare cells");
          saveCheckpoint();
        }
      }

      const autoBattery = pickups.find((pickup) =>
        !pickup.collected &&
        pickup.type === "battery" &&
        Math.hypot(player.x - pickup.x, player.y - pickup.y) < 0.68
      );
      if (autoBattery) {
        autoBattery.collected = true;
        inventory.battery++;
        if (!replaceEmptyFlashlightBattery()) {
          showItemHint("Battery cell collected · automatic replacement enabled");
        }
        horrorAudio.playTone(520, 0.18, 0.22);
        saveCheckpoint();
      }

      for (const enemy of enemies) {
        if (enemy.update(dt, player, elapsedTime)) {
          grabbed = true;
          horrorAudio.playTone(48, 0.8, 0.8);
          horrorAudio.playEnemyCue(enemy.x, enemy.y, "scream");
        }
        const previousState = enemyAudioStates.get(enemy);
        if (previousState !== enemy.state) {
          if (enemy.state === "CHASE") {
            horrorAudio.playEnemyCue(enemy.x, enemy.y, "scream");
          } else if (enemy.state === "INVESTIGATE" && previousState !== undefined) {
            horrorAudio.playEnemyCue(enemy.x, enemy.y, "whisper");
          }
          enemyAudioStates.set(enemy, enemy.state);
        }
      }
      if (keysCollected >= level.keysRequired &&
          renderer.exitDoorAngle >= Math.PI / 2 - 0.08 &&
          Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < 0.9) {
        escaped = true;
      }
    } else {
      document.querySelector("#interaction-prompt").hidden = true;
    }

    if (grabbed && gameState === "playing") {
      setGameState("caught", "CAUGHT", "The Aswang found you. Retry from your last checkpoint or try a fresh run.");
    }
    if (escaped && gameState === "playing") {
      setGameState("escaped", "ESCAPED", `Level ${level.id} complete in ${formatTime(elapsedTime)}.`);
      document.querySelector("#next-level-button").hidden = true;
      try {
        localStorage.removeItem(checkpointKey());
      } catch (error) {
        console.warn("Could not clear the completed level checkpoint.", error);
      }
    }

    if ((escaped || grabbed) && !runSubmitted) {
      runSubmitted = true;
      submitRun(
        level.id,
        Math.floor(elapsedTime * 1000),
        keysCollected,
        escaped
      ).then(async () => {
        if (!escaped) return;
        try {
          const updatedProgress = await getProgress();
          document.querySelector("#next-level-button").hidden = !updatedProgress.some(
            (entry) => entry.levelId === level.id + 1 && entry.unlocked
          );
        } catch (error) {
          console.error("Could not refresh level progress.", error);
          document.querySelector("#game-dialog-message").textContent +=
            " Completion was recorded, but the next-level status could not be refreshed.";
        }
      }).catch((error) => {
        console.error("Could not save the run result.", error);
        document.querySelector("#game-dialog-message").textContent +=
          " Run progress could not be saved; check your connection and try again.";
      });
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
    horrorAudio.update(
      active ? dt : 0,
      active ? Math.max(distanceTension, chaseTension) : 0,
      player,
      enemies,
      active
    );
    const subtitle = document.querySelector("#sound-subtitle");
    if (settings.subtitles && active && nearestDistance < 8) {
      subtitle.textContent = chaseTension ? "The Aswang is chasing you" : "You hear something nearby";
    } else {
      subtitle.textContent = "";
    }

    renderer.syncPlayer(player);
    renderer.syncKeys(level.keys);
    renderer.syncPickups(pickups);
    renderer.syncEnemies(enemies);
    renderer.setEquippedItem(selectedItem, inventory);
    renderer.update(dt, enemies, {
      intensity: active && !grabbed && !escaped && !player.hidden ? movementIntensity : 0,
      sprinting,
      strafe,
      flashlightOn: inventory.flashlightOn,
      flashlightCharge: inventory.flashlightCharge,
      reloading: inventory.reloading,
      reloadProgress: inventory.reloading
        ? 1 - reloadTimer / RELOAD_DURATION
        : 0
    });
    renderer.render();
    if (mapOpen) drawMap(level, player, enemies, pickups);
    updateInventoryHud(inventory, selectedItem);
    document.querySelector("#ammo-counter").textContent = inventory.gun
      ? `MAG ${inventory.magazineAmmo}/${MAGAZINE_CAPACITY} · RES ${inventory.ammo}`
      : "AMMO —";

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

  updateHud(level, keysCollected, elapsedTime, 0, grabbed, escaped);
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
  document.querySelector("#objective-panel").textContent =
    keysCollected >= level.keysRequired
      ? "Reach the exit"
      : `Find the keys · ${keysCollected}/${level.keysRequired}`;
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
