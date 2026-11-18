export function bfs(map, startX, startY, targetX, targetY) {
  const height = map.length;
  const width = map[0].length;
  const start = (startY * width) + startX;
  const target = (targetY * width) + targetX;
  const previous = new Int32Array(width * height);
  previous.fill(-1);

  const queue = [start];
  previous[start] = start;

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    const x = current % width;
    const y = (current / width) | 0;
    if (current === target) break;

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
      if (map[nextY][nextX] === 1) continue;

      const next = (nextY * width) + nextX;
      if (previous[next] !== -1) continue;

      previous[next] = current;
      queue.push(next);
    }
  }

  if (previous[target] === -1) return null;

  const path = [];
  let current = target;
  while (current !== start) {
    path.push([current % width, (current / width) | 0]);
    current = previous[current];
  }
  path.reverse();
  return path;
}

export function findReachable(map, startX, startY) {
  const height = map.length;
  const width = map[0].length;
  const start = (startY * width) + startX;
  const previous = new Int32Array(width * height);
  previous.fill(-1);

  const queue = [start];
  previous[start] = start;
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    const x = current % width;
    const y = (current / width) | 0;

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
      if (map[nextY][nextX] === 1) continue;

      const next = (nextY * width) + nextX;
      if (previous[next] !== -1) continue;
      previous[next] = current;
      queue.push(next);
    }
  }

  const reachable = [];
  for (let index = 0; index < previous.length; index++) {
    if (previous[index] !== -1) {
      reachable.push([index % width, (index / width) | 0]);
    }
  }
  return reachable;
}
