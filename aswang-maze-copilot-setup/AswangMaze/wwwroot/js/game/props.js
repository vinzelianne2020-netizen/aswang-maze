const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function createMazeProps(level) {
  const reserved = [level.start, level.exit, ...level.keys, ...level.spawns];
  const floors = [];
  for (let y = 1; y < level.height - 1; y++) {
    for (let x = 1; x < level.width - 1; x++) {
      if (level.map[y][x] !== 0) continue;
      const wall = DIRECTIONS.find(({ x: dx, y: dy }) => level.map[y + dy]?.[x + dx] === 1);
      if (!wall || reserved.some((point) => Math.hypot(point.x - x - 0.5, point.y - y - 0.5) < 1.8)) {
        continue;
      }
      const hash = (Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663)) >>> 0;
      floors.push({ x, y, wall, hash });
    }
  }
  floors.sort((a, b) => a.hash - b.hash);

  const props = [];
  const occupied = reserved.map((point) => ({ x: point.x, y: point.y }));
  const selectedCells = new Set();
  const addProp = (cell, type) => {
    const { x: dx, y: dy } = cell.wall;
    const wallMounted = type === "cabinet" || type === "locker" || type === "bed";
    const jitterX = ((cell.hash >>> 8) & 31) / 31 - 0.5;
    const jitterY = ((cell.hash >>> 13) & 31) / 31 - 0.5;
    props.push({
      type,
      x: wallMounted
        ? cell.x + 0.5 + dx * (type === "bed" ? -0.15 : 0.18)
        : cell.x + 0.5 + jitterX * 0.34,
      y: wallMounted
        ? cell.y + 0.5 + dy * (type === "bed" ? -0.15 : 0.18)
        : cell.y + 0.5 + jitterY * 0.34,
      rotation: wallMounted ? Math.atan2(-dx, -dy) : (cell.hash % 360) * Math.PI / 180,
      hideable: type === "cabinet" || type === "locker",
      radius: type === "cabinet" || type === "locker"
        ? 0.4
        : type === "bed"
          ? 0.72
          : type === "crate"
            ? 0.28
            : 0.16
    });
    occupied.push({ x: props[props.length - 1].x, y: props[props.length - 1].y });
  };

  const placeSpreadProp = (type, minimumSpacing) => {
    let cell = null;
    for (let spacing = minimumSpacing; spacing >= 1.5 && !cell; spacing -= 0.5) {
      let bestDistance = -1;
      for (const candidate of floors) {
        if (selectedCells.has(candidate)) continue;
        const x = candidate.x + 0.5;
        const y = candidate.y + 0.5;
        const distance = Math.min(...occupied.map((point) => Math.hypot(point.x - x, point.y - y)));
        if (distance >= spacing && distance > bestDistance) {
          cell = candidate;
          bestDistance = distance;
        }
      }
    }
    if (!cell) return false;
    selectedCells.add(cell);
    addProp(cell, type);
    return true;
  };

  const hideCount = Math.max(3, Math.min(7, Math.floor(level.width * level.height / 500)));
  for (let index = 0; index < hideCount; index++) {
    const type = index % 2 === 0 ? "locker" : "cabinet";
    if (!placeSpreadProp(type, 4)) break;
  }

  const bedCount = Math.max(2, Math.min(5, Math.floor(level.width * level.height / 180)));
  for (let index = 0; index < bedCount; index++) {
    if (!placeSpreadProp("bed", 4)) break;
  }

  const clutterTypes = ["garbage", "pot", "garbage", "pot", "crate", "bucket"];
  const clutterCount = Math.min(36, Math.floor(level.width * level.height / 36));
  for (let index = 0; index < clutterCount; index++) {
    if (!placeSpreadProp(clutterTypes[index % clutterTypes.length], 3)) break;
  }

  return props;
}
