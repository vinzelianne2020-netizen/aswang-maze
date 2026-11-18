import { apiRequest } from "../api.js";

export function parseMapData(mapData) {
  const rows = mapData.trim().split("\n");
  const height = rows.length;
  const width = rows[0].length;
  const map = new Array(height);
  const keys = [];
  const spawns = [];
  let exit = null;
  let start = null;

  for (let y = 0; y < height; y++) {
    if (rows[y].length !== width) {
      throw new Error("MapData rows must all have the same width.");
    }

    map[y] = new Array(width);
    for (let x = 0; x < width; x++) {
      const tile = rows[y][x];
      if (!"012345".includes(tile)) {
        throw new Error(`Unknown MapData tile: ${tile}`);
      }

      if (tile === "2") keys.push({ x: x + 0.5, y: y + 0.5, collected: false });
      if (tile === "4") spawns.push({ x: x + 0.5, y: y + 0.5 });
      if (tile === "3") exit = { x: x + 0.5, y: y + 0.5 };
      if (tile === "5") start = { x: x + 0.5, y: y + 0.5 };

      map[y][x] = tile === "1" ? 1 : 0;
    }
  }

  if (!start) throw new Error("MapData has no player start.");
  if (!exit) throw new Error("MapData has no exit.");

  return { map, width, height, keys, spawns, exit, start };
}

export async function loadLevel(levelId) {
  const level = await apiRequest(`/api/levels/${levelId}`);
  const parsed = parseMapData(level.mapData);

  return {
    ...level,
    ...parsed
  };
}
