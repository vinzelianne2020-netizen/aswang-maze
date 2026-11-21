export function createPlayer(level) {
  return {
    x: level.start.x,
    y: level.start.y,
    dirX: 1,
    dirY: 0,
    pitch: 0,
    planeX: 0,
    planeY: 0.66,
    radius: 0.2,
    jumpHeight: 0,
    jumpVelocity: 0
  };
}

export function rotatePlayer(player, angle) {
  const oldDirX = player.dirX;
  player.dirX =
    player.dirX * Math.cos(angle) -
    player.dirY * Math.sin(angle);
  player.dirY =
    oldDirX * Math.sin(angle) +
    player.dirY * Math.cos(angle);

  const oldPlaneX = player.planeX;
  player.planeX =
    player.planeX * Math.cos(angle) -
    player.planeY * Math.sin(angle);
  player.planeY =
    oldPlaneX * Math.sin(angle) +
    player.planeY * Math.cos(angle);
}

export function tryMovePlayer(player, map, dx, dy, obstacles = []) {
  const nextX = player.x + dx;
  const nextY = player.y + dy;

  const canOccupy = (x, y) => {
    for (const offsetX of [-player.radius, player.radius]) {
      for (const offsetY of [-player.radius, player.radius]) {
        if (map[Math.floor(y + offsetY)]?.[Math.floor(x + offsetX)] !== 0) return false;
      }
    }
    return obstacles.every((obstacle) =>
      Math.hypot(x - obstacle.x, y - obstacle.y) >= player.radius + obstacle.radius
    );
  };

  if (canOccupy(nextX, player.y)) {
    player.x = nextX;
  }

  if (canOccupy(player.x, nextY)) {
    player.y = nextY;
  }
}
