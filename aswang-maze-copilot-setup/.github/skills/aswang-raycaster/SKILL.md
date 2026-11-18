---
name: aswang-raycaster
description: Expert guidance and code for building a Wolfenstein-style first-person raycasting engine in plain HTML5 Canvas and vanilla JavaScript with no game engine. Use this skill whenever the user works on the Aswang Maze renderer, DDA raycasting, wall strips, fisheye, fog, textures, floor/ceiling, z-buffer, billboard sprites, player movement and wall-sliding collision, pointer lock, delta-time game loops, FPS or lag problems, or any "3D without WebGL" request, even if they only say "my walls look wrong" or "it's too slow".
---

# Raycaster (Phases 2 and 3)

Goal: 60 FPS first-person view on a grid map using only Canvas 2D.

## Build order (do not skip ahead)
1. Loop with delta time and fullscreen canvas.
2. Input state + pointer lock.
3. Flat-colored walls via DDA, fisheye-corrected.
4. Fog and N/S vs E/W shading.
5. Movement with axis-separated collision.
6. Z-buffer, then sprites (keys, aswang).
7. Textures, then floor/ceiling casting only if performance allows.
Verify each step visually before the next. A bug in step 3 poisons everything after it.

## Conventions
- Map is `map[y][x]`. Tile `1` is wall. Positions are floats in tile units (tile center = x+0.5).
- Camera: `pos(x,y)`, direction `dir(x,y)`, camera plane `plane(x,y)` perpendicular to dir. FOV ≈ 66° means `|plane| ≈ 0.66`.
- Rotation of dir and plane by angle `a`: `x' = x*cos(a) - y*sin(a)`, `y' = x*sin(a) + y*cos(a)`.

## Core DDA loop
```js
export function castRays(ctx, W, H, p, map, zBuf, fogK = 0.12) {
  for (let x = 0; x < W; x++) {
    const camX = 2 * x / W - 1;
    const rayX = p.dirX + p.planeX * camX;
    const rayY = p.dirY + p.planeY * camX;
    let mapX = Math.floor(p.x), mapY = Math.floor(p.y);
    const dX = rayX === 0 ? 1e30 : Math.abs(1 / rayX);
    const dY = rayY === 0 ? 1e30 : Math.abs(1 / rayY);
    let stepX, stepY, sideX, sideY;
    if (rayX < 0) { stepX = -1; sideX = (p.x - mapX) * dX; } else { stepX = 1; sideX = (mapX + 1 - p.x) * dX; }
    if (rayY < 0) { stepY = -1; sideY = (p.y - mapY) * dY; } else { stepY = 1; sideY = (mapY + 1 - p.y) * dY; }
    let side = 0, hit = false;
    while (!hit) {
      if (sideX < sideY) { sideX += dX; mapX += stepX; side = 0; }
      else { sideY += dY; mapY += stepY; side = 1; }
      if (map[mapY]?.[mapX] !== 0) hit = true;   // out of bounds counts as wall
    }
    const perp = side === 0 ? sideX - dX : sideY - dY;  // perpendicular = no fisheye
    zBuf[x] = perp;
    const lineH = Math.min(H * 4, Math.floor(H / perp));
    const top = Math.floor((H - lineH) / 2);
    const shade = (side === 1 ? 0.7 : 1) / (1 + perp * perp * fogK);
    const c = Math.floor(180 * shade);
    ctx.fillStyle = `rgb(${c},${Math.floor(c*0.8)},${Math.floor(c*0.7)})`;
    ctx.fillRect(x, top, 1, lineH);
  }
}
```
Use `map[..] !== 0` only if non-wall tiles (keys, spawns) are stripped to `0` when the level loads. Otherwise test `=== 1`.

## Performance rules
- Render at reduced internal resolution (e.g. 640x360), CSS-scale to fullscreen with `image-rendering: pixelated`. This is the biggest single win.
- For textures, prefer `drawImage(tex, texX, 0, 1, texH, x, top, 1, lineH)` over per-pixel `ImageData` for walls. Use `ImageData` + a `Uint32Array` only for floor/ceiling.
- Floor/ceiling: start with two vertical gradients. Only add per-pixel floor casting later and render it at half resolution.
- No allocation in the frame loop: reuse arrays (`zBuf = new Float32Array(W)` once), avoid template-string colors every column by precomputing a shade LUT of ~256 entries.
- Cap `dt` (`Math.min(dt, 0.05)`) so tab-switching cannot teleport the player through walls.

## Movement and collision
```js
const R = 0.2; // player radius
function tryMove(p, map, dx, dy) {
  if (!solid(map, p.x + dx + Math.sign(dx) * R, p.y)) p.x += dx;
  if (!solid(map, p.x, p.y + dy + Math.sign(dy) * R)) p.y += dy;
}
```
Axis-separated checks give wall sliding for free. Normalize diagonal input so strafe+forward is not 1.41x faster. Speed in tiles/second multiplied by `dt`.

## Sprites (billboards)
1. Sort by squared distance, far to near.
2. Transform to camera space:
```js
const invDet = 1 / (p.planeX * p.dirY - p.dirX * p.planeY);
const tx = invDet * (p.dirY * sx - p.dirX * sy);   // sx,sy = sprite - player
const ty = invDet * (-p.planeY * sx + p.planeX * sy); // depth
if (ty <= 0.1) continue;
const screenX = Math.floor((W / 2) * (1 + tx / ty));
const size = Math.abs(Math.floor(H / ty));
```
3. Draw column by column; skip a column when `ty >= zBuf[col]`. Apply the same fog formula as walls.
4. Sprites facing the camera need no rotation. For the aswang, pick the frame from the player-relative angle only if you have directional art.

## Pointer lock
Request lock only inside a click handler. Handle `pointerlockchange`: if lock is lost during play, open the pause modal. Use `movementX * sens` to rotate (radians). Clamp nothing for yaw; there is no pitch in classic raycasting (fake it with a vertical offset of the horizon if wanted, max ±H/6).

## Debug checklist
| Symptom | Likely cause |
|---|---|
| Curved/fisheye walls | Used Euclidean distance instead of perpendicular |
| Walls flicker at edges | Not using `1e30` for zero ray components |
| Stretched or mirrored texture | Missing flip when `side===0 && rayX>0` or `side===1 && rayY<0` |
| Player stuck in walls | Collision radius too small or `dt` not capped |
| Sprite visible through walls | Missing z-buffer check per column |
| Sprite jitters | Rounding screenX/size inconsistently |
| Slow | Full resolution, per-pixel loops, string allocations per column |
