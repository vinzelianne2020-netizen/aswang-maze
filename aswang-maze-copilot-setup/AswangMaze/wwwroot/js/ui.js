import { getToken, createPlayer } from "./api.js";
import { emit, on } from "./events.js";

$(function () {
  const usernameModalElement = document.querySelector("#username-modal");
  const usernameModal = new bootstrap.Modal(usernameModalElement);
  const usernameForm = document.querySelector("#username-form");
  const usernameInput = document.querySelector("#username");
  const usernameError = document.querySelector("#username-error");

  $("#play-button").on("click", () => {
    if (!getToken()) {
      usernameModal.show();
      usernameInput.focus();
      return;
    }
    emit("level:start", { levelId: 1 });
  });

  $("#levels-button").on("click", () => emit("menu:levels"));
  $("#leaderboard-button").on("click", () => emit("menu:leaderboard"));
  $("#settings-button").on("click", () => emit("menu:settings"));

  // Prevent invalid form submission and keep API errors visible in the modal.
  usernameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    usernameError.classList.add("d-none");

    const username = usernameInput.value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
      usernameError.textContent =
        "Use 3-16 letters, digits, or underscores.";
      usernameError.classList.remove("d-none");
      return;
    }

    const submitButton = usernameForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Entering...";

    try {
      await createPlayer(username);
      usernameModal.hide();
      emit("level:start", { levelId: 1 });
    } catch (error) {
      usernameError.textContent = error.message;
      usernameError.classList.remove("d-none");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enter";
    }
  });

  on("level:start", ({ levelId }) => {
    if (document.querySelector("#game-canvas")) {
      emit("game:start", { levelId });
    } else {
      window.location.href = `/game-test.html?level=${levelId}`;
    }
  });

  on("menu:levels", () => {
    showToast("Level Select", "Level select is coming in the next slice.");
  });
  on("menu:leaderboard", () => {
    showToast("Leaderboard", "Leaderboard view is coming in the next slice.");
  });
  on("menu:settings", () => {
    showToast("Settings", "Settings will be added in the next slice.");
  });

  function showToast(title, message) {
    document.querySelector("#toast-title").textContent = title;
    document.querySelector("#toast-message").textContent = message;
    bootstrap.Toast.getOrCreateInstance(document.querySelector("#app-toast")).show();
  }
});
