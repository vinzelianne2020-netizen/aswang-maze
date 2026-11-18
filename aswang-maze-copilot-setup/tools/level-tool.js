const fs = require("node:fs");
const path = require("node:path");

const specs = [
  { order: 2, name: "Lumang Balay", width: 21, height: 21, keys: 3, enemies: 1, enemySpeed: 1.0, fog: 6.5, seed: 1202 },
  { order: 3, name: "Sementeryo", width: 25, height: 25, keys: 3, enemies: 1, enemySpeed: 1.1, fog: 5.5, seed: 1303 },
  { order: 4, name: "Kagubatan", width: 31, height: 31, keys: 4, enemies: 2, enemySpeed: 1.0, fog: 5.0, seed: 1404 },
  { order: 5, name: "Lungib sa Kapre", width: 31, height: 31, keys: 5, enemies: 2, enemySpeed: 1.15, fog: 4.5, seed: 1505 }
];

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function generate(width, height, loops, random) {
  const grid = Array.from({ length: height }, () => Array(width).fill(1));
  const stack = [[1, 1]];
  grid[1][1] = 0;

  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = [[2, 0], [-2, 0], [0, 2], [0, -2]]
      .map(([dx, dy]) => [x + dx, y + dy, dx, dy])
      .filter(([nx, ny]) =>
        nx > 0 &&
        ny > 0 &&
        nx < width - 1 &&
        ny < height - 1 &&
        grid[ny][nx] === 1
      );

    if (options.length === 0) {
      stack.pop();
      continue;
    }

    const [nx, ny, dx, dy] =
      options[Math.floor(random() * options.length)];
    grid[y + dy / 2][x + dx / 2] = 0;
    grid[ny][nx] = 0;
    stack.push([nx, ny]);
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x] !== 1 || random() >= loops) continue;
      const horizontal =
        grid[y][x - 1] === 0 &&
        grid[y][x + 1] === 0 &&
        grid[y - 1][x] === 1 &&
        grid[y + 1][x] === 1;
      const vertical =
        grid[y - 1][x] === 0 &&
        grid[y + 1][x] === 0 &&
        grid[y][x - 1] === 1 &&
        grid[y][x + 1] === 1;
      if (horizontal || vertical) grid[y][x] = 0;
    }
  }

  return grid;
}

function distances(grid, startX, startY) {
  const height = grid.length;
  const width = grid[0].length;
  const result = new Map();
  const queue = [[startX, startY]];
  result.set(`${startX},${startY}`, 0);

  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index];
    const distance = result.get(`${x},${y}`);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= width ||
        ny >= height ||
        grid[ny][nx] === 1 ||
        result.has(key)
      ) continue;
      result.set(key, distance + 1);
      queue.push([nx, ny]);
    }
  }
  return result;
}

function orderedPermutations(items) {
  if (items.length <= 1) return [items];
  const result = [];
  for (let index = 0; index < items.length; index++) {
    const remainder = items.filter((_, itemIndex) => itemIndex !== index);
    for (const permutation of orderedPermutations(remainder)) {
      result.push([items[index], ...permutation]);
    }
  }
  return result;
}

function shortestRoute(grid, start, keys, exit) {
  const points = [start, ...keys, exit];
  const pairDistances = new Map();

  for (const from of points) {
    const distancesFromPoint = distances(grid, from.x, from.y);
    for (const to of points) {
      const distance = distancesFromPoint.get(`${to.x},${to.y}`);
      if (distance === undefined) throw new Error("An entity is unreachable.");
      pairDistances.set(`${from.x},${from.y}->${to.x},${to.y}`, distance);
    }
  }

  let shortest = Infinity;
  for (const route of orderedPermutations(keys)) {
    let total = 0;
    let previous = start;
    for (const target of [...route, exit]) {
      total += pairDistances.get(
        `${previous.x},${previous.y}->${target.x},${target.y}`
      );
      previous = target;
    }
    shortest = Math.min(shortest, total);
  }
  return shortest;
}

function placeEntities(grid, spec, random) {
  const height = grid.length;
  const width = grid[0].length;
  const candidates = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x] === 0) candidates.push({ x, y });
    }
  }

  candidates.sort((a, b) => {
    const da = Math.hypot(a.x - 1, a.y - 1);
    const db = Math.hypot(b.x - 1, b.y - 1);
    return da - db;
  });

  const start =
    candidates[Math.floor(random() * candidates.length * 0.08)] ||
    candidates[0];
  grid[start.y][start.x] = 5;

  const fromStart = distances(grid, start.x, start.y);
  const reachable = candidates
    .filter(({ x, y }) =>
      fromStart.has(`${x},${y}`) &&
      x !== start.x &&
      y !== start.y
    )
    .sort((a, b) =>
      (fromStart.get(`${b.x},${b.y}`) || 0) -
      (fromStart.get(`${a.x},${a.y}`) || 0)
    );

  if (reachable.length < spec.keys + spec.enemies + 1) {
    throw new Error(`${spec.name}: not enough reachable floor tiles.`);
  }

  const exit = reachable[Math.floor(random() * Math.min(40, reachable.length * 0.15))] ||
    reachable[0];
  grid[exit.y][exit.x] = 3;

  const exitDistance = fromStart.get(`${exit.x},${exit.y}`);
  const keyCandidates = reachable.filter(({ x, y }) =>
    grid[y][x] === 0 &&
    x !== exit.x &&
    y !== exit.y &&
    (fromStart.get(`${x},${y}`) || 0) >= exitDistance * 0.25 &&
    (fromStart.get(`${x},${y}`) || 0) <= exitDistance * 0.95 &&
    Math.abs(x - exit.x) + Math.abs(y - exit.y) >= 8
  );

  const keys = [];
  for (const candidate of keyCandidates) {
    if (keys.length >= spec.keys) break;
    const separated = keys.every((key) =>
      Math.abs(key.x - candidate.x) + Math.abs(key.y - candidate.y) >= 8
    );
    if (!separated) continue;
    keys.push(candidate);
  }

  if (keys.length !== spec.keys) {
    throw new Error(`${spec.name}: could not place ${spec.keys} separated keys.`);
  }
  for (const key of keys) grid[key.y][key.x] = 2;

  const spawns = [];
  for (const candidate of reachable) {
    if (spawns.length >= spec.enemies) break;
    const startDistance =
      fromStart.get(`${candidate.x},${candidate.y}`) || 0;
    if (
      grid[candidate.y][candidate.x] !== 0 ||
      startDistance < 12
    ) continue;
    const notOnExitRoute =
      Math.abs(candidate.x - exit.x) + Math.abs(candidate.y - exit.y) >= 4;
    if (notOnExitRoute) spawns.push(candidate);
  }

  if (spawns.length !== spec.enemies) {
    throw new Error(`${spec.name}: could not place ${spec.enemies} enemy spawns.`);
  }
  for (const spawn of spawns) grid[spawn.y][spawn.x] = 4;

  return { start, exit, keys, spawns };
}

function validate(grid, spec, entities) {
  const height = grid.length;
  const width = grid[0].length;
  if (width !== spec.width || height !== spec.height) {
    throw new Error(`${spec.name}: invalid dimensions.`);
  }
  for (let x = 0; x < width; x++) {
    if (grid[0][x] !== 1 || grid[height - 1][x] !== 1) {
      throw new Error(`${spec.name}: invalid horizontal border.`);
    }
  }
  for (let y = 0; y < height; y++) {
    if (grid[y][0] !== 1 || grid[y][width - 1] !== 1) {
      throw new Error(`${spec.name}: invalid vertical border.`);
    }
  }

  const reachable = distances(grid, entities.start.x, entities.start.y);
  for (const target of [entities.exit, ...entities.keys, ...entities.spawns]) {
    if (!reachable.has(`${target.x},${target.y}`)) {
      throw new Error(`${spec.name}: unreachable entity.`);
    }
  }

  let startCount = 0;
  let exitCount = 0;
  let keyCount = 0;
  let spawnCount = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (![0, 1, 2, 3, 4, 5].includes(tile)) {
        throw new Error(`${spec.name}: unknown tile.`);
      }
      if (tile === 5) startCount++;
      if (tile === 3) exitCount++;
      if (tile === 2) keyCount++;
      if (tile === 4) spawnCount++;
    }
  }
  if (startCount !== 1 || exitCount !== 1 ||
      keyCount !== spec.keys || spawnCount !== spec.enemies) {
    throw new Error(`${spec.name}: entity counts are invalid.`);
  }
}

function mapData(grid) {
  return grid.map((row) => row.join("")).join("\n");
}

const output = [];
for (const spec of specs) {
  const random = mulberry32(spec.seed);
  const grid = generate(spec.width, spec.height, spec.order === 2 ? 0.12 : 0.1, random);
  const entities = placeEntities(grid, spec, random);
  validate(grid, spec, entities);

  const routeTiles = shortestRoute(grid, entities.start, entities.keys, entities.exit);
  const minPossibleMs =
    Math.floor(routeTiles / 4.5 * 1000 * 0.9);
  const starTime3 =
    Math.floor(routeTiles / 2.8 * 1000 * 1.1);
  const starTime2 =
    Math.floor(routeTiles / 2.8 * 1000 * 1.8);

  output.push({
    ...spec,
    mapData: mapData(grid),
    start: entities.start,
    exit: entities.exit,
    routeTiles,
    minPossibleMs,
    starTime3,
    starTime2
  });
}

const outputDirectory = path.resolve(__dirname, "..", "generated");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, "level-report.json"),
  JSON.stringify(output, null, 2)
);

for (const level of output) {
  console.log(`\n# ${level.name} (Order ${level.order})`);
  console.log(level.mapData);
  console.log(JSON.stringify({
    width: level.width,
    height: level.height,
    start: level.start,
    keys: level.keys,
    enemies: level.enemies,
    enemySpeed: level.enemySpeed,
    fogDistance: level.fog,
    routeTiles: level.routeTiles,
    minPossibleMs: level.minPossibleMs,
    starTime3: level.starTime3,
    starTime2: level.starTime2
  }));
}
