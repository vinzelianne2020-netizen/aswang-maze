---
name: aswang-enemy-ai
description: Design and implement the aswang enemy AI for a grid-based first-person horror game in vanilla JavaScript. Covers BFS and A* pathfinding, patrol/investigate/chase/search state machines, line of sight on a grid, hearing and noise, fairness tuning, multi-enemy performance, and catch/jumpscare triggers. Use this skill whenever the user works on the aswang, enemy behavior, "make it chase me", pathfinding, stealth, detection, difficulty balance, or says the enemy is too dumb, too cheap, or lags the game.
---

# Aswang AI (Phase 4)

Horror comes from tension and fairness, not from a perfect hunter. The aswang should feel intelligent but beatable: it follows what it perceives, not what it knows.

## Rule 1: the AI perceives, it never cheats
Chase only when it **sees** the player (line of sight within range and inside its view cone) or **hears** a loud event. Without perception it searches the last known position. Omniscient tracking feels unfair and kills tension.

## State machine
```
PATROL ──(heard noise)──► INVESTIGATE ──(arrived, nothing)──► SEARCH ──(timeout)──► PATROL
   │                          │                                   ▲
   └──────(sees player)───────┴──────────►  CHASE ──(lost sight)──┘
```
| State | Behavior | Speed |
|---|---|---|
| PATROL | Walk between random reachable waypoints, pause 1 to 3 s at each | 0.6x |
| INVESTIGATE | Path to the noise position | 1.0x |
| CHASE | Path to player, recompute every 0.3 s | 1.15x (slightly above walk, below sprint) |
| SEARCH | Go to last seen position, then look around 4 to 6 s | 0.8x |
Keep a single `enemy.state` string plus `enemy.stateTime`. Transition in one function, `setState(next)`, so entry actions (play growl, reset timers) live in one place.

## BFS on the grid
```js
export function bfs(map, sx, sy, tx, ty) {
  const H = map.length, W = map[0].length;
  const prev = new Int32Array(W * H).fill(-1);
  const q = [sy * W + sx]; prev[q[0]] = q[0];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i], cx = cur % W, cy = (cur / W) | 0;
    if (cx === tx && cy === ty) break;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || map[ny][nx] === 1 || prev[n] !== -1) continue;
      prev[n] = cur; q.push(n);
    }
  }
  if (prev[ty * W + tx] === -1) return null;
  const path = []; let c = ty * W + tx;
  while (c !== sy * W + sx) { path.push([c % W, (c / W) | 0]); c = prev[c]; }
  return path.reverse();
}
```
Use `q` with an index pointer (not `shift()`, which is O(n)). Switch to A* with a binary heap only if maps exceed roughly 64x64.

## Movement along the path
Move toward the center of the next tile at `speed * dt`, pop the tile when within 0.05. Never teleport. Reuse the player's `tryMove` so the enemy does not clip walls. Treat other enemies as soft obstacles by adding a small separation push.

## Line of sight on a grid
Step a DDA ray from enemy to player (same DDA as the renderer, stop at the first wall). Visible if no wall is hit before the player's tile, distance < `viewDist` (about 8 tiles, scaled by `FogDistance`), and the angle to the player is within about 70° of the enemy facing. Cache the result for 0.1 s.

## Hearing
Emit `noise(x, y, radius)` events: sprint steps radius 6, walking radius 2, picking up a key radius 5, flashlight click radius 1. An enemy in PATROL or SEARCH with `distance <= radius` and a path length under `radius * 2` enters INVESTIGATE at the noise point. Using path length instead of straight distance makes walls muffle sound, which feels right.

## Fairness and tuning
- **Grace period:** aswang cannot detect the player for the first 5 s of a level.
- **Catch radius:** 0.5 tile. Add 0.3 s of "grab" slow-motion before game over so deaths feel earned.
- **Rubber banding:** if the player has not seen the enemy for 60 s, bias patrol waypoints toward the player's area (not their exact tile).
- **Escape hatches:** every level needs at least one loop in the maze so the player can circle. Dead-end-only mazes are unwinnable chases.
- Expose `EnemySpeed` and `viewDist` from the level data so difficulty is data-driven, not hard-coded.

## Performance
- Recompute paths on a timer with a random offset per enemy so they do not all run BFS in the same frame.
- Precompute a distance-from-player flood fill once per 0.3 s and let all enemies descend it, instead of one BFS per enemy.
- Skip AI updates for enemies beyond 20 tiles at 1/4 rate.

## Testing checklist
- [ ] Enemy never walks into walls or oscillates between two tiles
- [ ] Unreachable targets (null path) fall back to PATROL
- [ ] Loses the player after breaking line of sight and waiting
- [ ] Sprinting attracts it, crouch/walk does not
- [ ] 3 enemies on a 40x40 map hold 60 FPS
