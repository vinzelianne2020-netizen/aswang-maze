const STORAGE_KEY = "aswang-maze-settings";

export const DEFAULT_SETTINGS = Object.freeze({
  mouseSensitivity: 1,
  brightness: 1.05,
  quality: "high",
  masterVolume: 0.8,
  effectsVolume: 0.8,
  ambienceVolume: 0.55,
  subtitles: true,
  reducedFlashing: false,
  controls: {
    forward: "w",
    back: "s",
    left: "a",
    right: "d",
    sprint: "shift",
    jump: " ",
    interact: "e",
    reload: "r",
    flashlight: "f",
    map: "m",
    use: "e",
    pause: "escape"
  }
});

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const controls = { ...DEFAULT_SETTINGS.controls, ...saved.controls };
    for (const [action, key] of Object.entries(controls)) {
      if (typeof key !== "string" || key.length > 20) controls[action] = DEFAULT_SETTINGS.controls[action];
    }
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      controls,
      mouseSensitivity: clampNumber(saved.mouseSensitivity, 0.2, 3, DEFAULT_SETTINGS.mouseSensitivity),
      brightness: clampNumber(saved.brightness, 0.5, 1.8, DEFAULT_SETTINGS.brightness),
      masterVolume: clampNumber(saved.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
      effectsVolume: clampNumber(saved.effectsVolume, 0, 1, DEFAULT_SETTINGS.effectsVolume),
      ambienceVolume: clampNumber(saved.ambienceVolume, 0, 1, DEFAULT_SETTINGS.ambienceVolume),
      quality: ["low", "medium", "high"].includes(saved.quality) ? saved.quality : DEFAULT_SETTINGS.quality,
      subtitles: saved.subtitles !== false,
      reducedFlashing: Boolean(saved.reducedFlashing)
    };
  } catch (error) {
    console.warn("Could not load saved game settings.", error);
    return { ...DEFAULT_SETTINGS, controls: { ...DEFAULT_SETTINGS.controls } };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clampNumber(value, min, max, fallback) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}
