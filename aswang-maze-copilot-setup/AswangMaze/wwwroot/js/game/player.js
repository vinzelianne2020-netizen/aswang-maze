export function createPlayer(level) {
  return {
    x: level.start.x,
    y: level.start.y,
    dirX: 1,
    dirY: 0,
    planeX: 0,
    planeY: 0.66,
    radius: 0.2
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

export function tryMovePlayer(player, map, dx, dy) {
  const nextX = player.x + dx;
  const nextY = player.y + dy;

  if (map[Math.floor(player.y)]?.[
    Math.floor(nextX + Math.sign(dx) * player.radius)
  ] !== 1) {
    player.x = nextX;
  }

  if (map[
    Math.floor(nextY + Math.sign(dy) * player.radius)
  ]?.[Math.floor(player.x)] !== 1) {
    player.y = nextY;
  }
}
