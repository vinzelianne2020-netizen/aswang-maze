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
  const addProp = (cell, type) => {
    const { x: dx, y: dy } = cell.wall;
    props.push({
      type,
      x: cell.x + 0.5 + dx * 0.43,
      y: cell.y + 0.5 + dy * 0.43,
      rotation: Math.atan2(-dx, -dy),
      hideable: type === "cabinet" || type === "locker",
      radius: type === "cabinet" || type === "locker" ? 0.12 : 0.09
    });
  };

  const hideCount = Math.max(3, Math.min(7, Math.floor(level.width * level.height / 500)));
  const hidingSpots = [];
  for (const cell of floors) {
    if (hidingSpots.length >= hideCount) break;
    if (hidingSpots.some((other) => Math.hypot(cell.x - other.x, cell.y - other.y) < 4)) continue;
    const type = (cell.hash & 1) === 0 ? "locker" : "cabinet";
    addProp(cell, type);
    hidingSpots.push(props[props.length - 1]);
  }

  const clutterTypes = ["garbage", "pot", "garbage", "pot", "crate", "bucket"];
  for (const cell of floors) {
    if (props.length >= hidingSpots.length + Math.min(36, Math.floor(level.width * level.height / 36))) break;
    if (props.some((prop) => Math.hypot(prop.x - cell.x - 0.5, prop.y - cell.y - 0.5) < 1.6)) continue;
    addProp(cell, clutterTypes[cell.hash % clutterTypes.length]);
  }

  return props;
}
