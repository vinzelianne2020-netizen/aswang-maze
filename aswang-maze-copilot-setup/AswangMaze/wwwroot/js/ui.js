import {
  createPlayer,
  getLeaderboard,
  getLevels,
  getProgress,
  getToken
} from "./api.js";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./game/settings.js";
import { emit, on } from "./events.js";

$(function () {
  const usernameModal = new bootstrap.Modal(document.querySelector("#username-modal"));
  const levelsModal = new bootstrap.Modal(document.querySelector("#levels-modal"));
  const leaderboardModal = new bootstrap.Modal(document.querySelector("#leaderboard-modal"));
  const settingsModal = new bootstrap.Modal(document.querySelector("#menu-settings-modal"));
  const usernameForm = document.querySelector("#username-form");
  const usernameInput = document.querySelector("#username");
  const usernameError = document.querySelector("#username-error");
  let pendingAction = null;
  let levels = [];
  let progress = [];

  $("#play-button").on("click", () => beginAction({ type: "play", levelId: 1 }));
  $("#levels-button").on("click", () => beginAction({ type: "levels" }));
  $("#leaderboard-button").on("click", () => beginAction({ type: "leaderboard" }));
  $("#settings-button").on("click", () => {
    populateSettings();
    settingsModal.show();
  });

  usernameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    usernameError.classList.add("d-none");

    const username = usernameInput.value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
      usernameError.textContent = "Use 3-16 letters, digits, or underscores.";
      usernameError.classList.remove("d-none");
      return;
    }

    const submitButton = usernameForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Entering...";
    try {
      await createPlayer(username);
      usernameModal.hide();
      const action = pendingAction;
      pendingAction = null;
      if (action?.type === "play") emit("level:start", { levelId: action.levelId });
      else if (action?.type === "levels") await showLevels();
      else if (action?.type === "leaderboard") await showLeaderboard();
    } catch (error) {
      usernameError.textContent = error.message;
      usernameError.classList.remove("d-none");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enter";
    }
  });

  on("level:start", ({ levelId }) => {
    window.location.href = `/dist/game-test.html?level=${levelId}`;
  });

  on("menu:levels", () => beginAction({ type: "levels" }));
  on("menu:leaderboard", () => beginAction({ type: "leaderboard" }));
  on("menu:settings", () => settingsModal.show());

  async function beginAction(action) {
    if (!getToken()) {
      pendingAction = action;
      usernameModal.show();
      usernameInput.focus();
      return;
    }
    if (action.type === "play") emit("level:start", { levelId: action.levelId });
    else if (action.type === "levels") await showLevels();
    else await showLeaderboard();
  }

  async function loadMenuData() {
    [levels, progress] = await Promise.all([getLevels(), getProgress()]);
  }

  async function showLevels() {
    try {
      await loadMenuData();
      const container = document.querySelector("#levels-list");
      container.replaceChildren();
      for (const level of levels) {
        const record = progress.find((entry) => entry.levelId === level.id);
        const card = document.createElement("div");
        card.className = "level-card";
        const details = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = `${level.order}. ${level.name}`;
        const stats = document.createElement("span");
        stats.textContent = record?.bestTimeMs
          ? `Best ${formatTime(record.bestTimeMs)} · ${record.stars} stars`
          : level.unlocked ? "Not completed" : "Complete the previous level to unlock";
        details.append(title, stats);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-sm btn-danger";
        button.textContent = level.unlocked ? "Play" : "Locked";
        button.disabled = !level.unlocked;
        button.addEventListener("click", () => emit("level:start", { levelId: level.id }));
        card.append(details, button);
        container.append(card);
      }
      populateLeaderboardLevels();
      levelsModal.show();
    } catch (error) {
      showToast("Levels unavailable", error.message);
    }
  }

  async function showLeaderboard() {
    try {
      await loadMenuData();
      populateLeaderboardLevels();
      leaderboardModal.show();
      await refreshLeaderboard();
    } catch (error) {
      showToast("Leaderboard unavailable", error.message);
    }
  }

  function populateLeaderboardLevels() {
    const select = document.querySelector("#leaderboard-level");
    const currentValue = select.value;
    select.replaceChildren();
    for (const level of levels) {
      const option = document.createElement("option");
      option.value = level.id;
      option.textContent = `${level.order}. ${level.name}`;
      select.append(option);
    }
    if (levels.some((level) => String(level.id) === currentValue)) select.value = currentValue;
  }

  document.querySelector("#leaderboard-level").addEventListener("change", refreshLeaderboard);

  async function refreshLeaderboard() {
    const list = document.querySelector("#leaderboard-list");
    list.replaceChildren();
    try {
      const entries = await getLeaderboard(Number(document.querySelector("#leaderboard-level").value));
      if (!entries.length) {
        list.textContent = "No escaped runs yet. Be the first out.";
        return;
      }
      for (const entry of entries) {
        const row = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = entry.username;
        const time = document.createElement("span");
        time.textContent = formatTime(entry.timeMs);
        row.append(name, time);
        list.append(row);
      }
    } catch (error) {
      list.textContent = error.message;
    }
  }

  function populateSettings() {
    const settings = loadSettings();
    const fields = {
      mouseSensitivity: "#menu-sensitivity",
      brightness: "#menu-brightness",
      quality: "#menu-quality",
      masterVolume: "#menu-master-volume",
      effectsVolume: "#menu-effects-volume",
      ambienceVolume: "#menu-ambience-volume"
    };
    for (const [setting, selector] of Object.entries(fields)) {
      const field = document.querySelector(selector);
      field.value = settings[setting];
      field.oninput = () => {
        settings[setting] = setting === "quality" ? field.value : Number(field.value);
        saveSettings(settings);
      };
    }
    for (const [setting, selector] of [
      ["subtitles", "#menu-subtitles"],
      ["reducedFlashing", "#menu-reduced-flashing"]
    ]) {
      const field = document.querySelector(selector);
      field.checked = settings[setting];
      field.onchange = () => {
        settings[setting] = field.checked;
        saveSettings(settings);
      };
    }
    for (const button of document.querySelectorAll("[data-menu-bind]")) {
      const action = button.dataset.menuBind;
      const label = button.textContent.split(":")[0];
      button.textContent = `${label}: ${settings.controls[action]}`;
      button.onclick = () => {
        button.textContent = `${label}: press a key...`;
        const capture = (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          settings.controls[action] = event.key.toLowerCase();
          button.textContent = `${label}: ${settings.controls[action]}`;
          saveSettings(settings);
          window.removeEventListener("keydown", capture, true);
        };
        window.addEventListener("keydown", capture, true);
      };
    }
  }

  document.querySelector("#menu-settings-reset").addEventListener("click", () => {
    saveSettings({ ...DEFAULT_SETTINGS, controls: { ...DEFAULT_SETTINGS.controls } });
    populateSettings();
  });

  function showToast(title, message) {
    document.querySelector("#toast-title").textContent = title;
    document.querySelector("#toast-message").textContent = message;
    bootstrap.Toast.getOrCreateInstance(document.querySelector("#app-toast")).show();
  }

  function formatTime(milliseconds) {
    const seconds = milliseconds / 1000;
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${(seconds - minutes * 60).toFixed(2).padStart(5, "0")}`;
  }
});
