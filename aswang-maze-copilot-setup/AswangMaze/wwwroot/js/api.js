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
  const existingToken = getToken();
  if (existingToken && !existingToken.startsWith("dev-")) return existingToken;
  if (existingToken) setToken("");

  let username = `Player${Date.now().toString(36)}`;
  try {
    username = window.prompt("Dev login - enter a username", "Player1") || username;
  } catch {
    // Embedded browsers can disable prompt(); use the same default player.
  }

  const player = await createPlayer(username);
  return player.token;
}

export async function submitRun(levelId, timeMs, keysCollected, escaped) {
  return apiRequest("/api/runs", {
    method: "POST",
    body: JSON.stringify({ levelId, timeMs, keysCollected, escaped })
  });
}

export async function getLevels() {
  return apiRequest("/api/levels");
}

export async function getProgress() {
  return apiRequest("/api/players/me/progress");
}

export async function getLeaderboard(levelId, top = 10) {
  return apiRequest(`/api/leaderboard/${levelId}?top=${top}`);
}
