const TOKEN_KEY = "am_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {
      // Keep the HTTP status message when the response has no JSON body.
    }
    throw new Error(message);
  }

  return response.status === 204 ? null : response.json();
}

export async function createPlayer(username) {
  const player = await apiRequest("/api/players", {
    method: "POST",
    body: JSON.stringify({ username })
  });
  setToken(player.token);
  return player;
}

export async function ensureTestPlayer() {
  if (getToken()) return getToken();

  const username = window.prompt("Dev login - enter a username", "Player1");
  if (!username) throw new Error("A username is required.");

  const player = await createPlayer(username);
  return player.token;
}

export async function submitRun(levelId, timeMs, keysCollected, escaped) {
  return apiRequest("/api/runs", {
    method: "POST",
    body: JSON.stringify({ levelId, timeMs, keysCollected, escaped })
  });
}
