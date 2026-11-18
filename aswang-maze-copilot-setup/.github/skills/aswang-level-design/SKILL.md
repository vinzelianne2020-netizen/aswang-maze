---
name: aswang-level-design
description: Design, generate, validate and balance grid-based maze levels for the Aswang Maze horror game. Covers the MapData string format, procedural maze generation, adding loops, placing keys/exit/spawns, solvability checks, computing MinPossibleMs and star thresholds with BFS, difficulty curves, and the five named levels. Use this skill whenever the user creates or edits levels, MapData, maze layouts, seeds levels into SQLite, balances difficulty, star times, key counts, or says a level is too hard, too easy, unwinnable, or boring.
---

# Level Design (Phase 7, also needed from Phase 1)

## MapData format
Newline-separated rows, one char per tile. Width and height must be odd for the generator below.
`1` wall · `0` floor · `2` key · `3` exit · `4` aswang spawn · `5` player start
At load, the client scans for `2`, `3`, `4`, `5`, records their positions, and rewrites them to `0` in the collision grid (keys and enemies are entities, not tiles). The outer border must be all `1`.

## Maze generation (recursive backtracker, then add loops)
```js
export function generate(w, h, loops = 0.08) {
  const g = Array.from({ length: h }, () => Array(w).fill(1));
  const stack = [[1, 1]]; g[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = [[2,0],[-2,0],[0,2],[0,-2]]
      .map(([dx, dy]) => [x + dx, y + dy, dx, dy])
      .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && g[ny][nx] === 1);
    if (!opts.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = opts[Math.floor(Math.random() * opts.length)];
    g[y + dy / 2][x + dx / 2] = 0; g[ny][nx] = 0; stack.push([nx, ny]);
  }
  // knock out extra walls to create loops so the player can circle the enemy
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++)
    if (g[y][x] === 1 && Math.random() < loops) {
      const horiz = g[y][x-1] === 0 && g[y][x+1] === 0 && g[y-1][x] === 1 && g[y+1][x] === 1;
      const vert  = g[y-1][x] === 0 && g[y+1][x] === 0 && g[y][x-1] === 1 && g[y][x+1] === 1;
      if (horiz || vert) g[y][x] = 0;
    }
  return g;
}
```
Perfect mazes (no loops) are tutorial-grade only; the chase needs loops. Hand-designed levels (Lumang Balay as rooms and corridors, Sementeryo as open plots with obstacle rows) usually feel better than pure random. Use the generator to draft, then edit by hand.

## Placement rules
- **Start:** a dead-end or room corner. **Exit:** the tile with the largest BFS distance from the start.
- **Keys:** pick floor tiles with BFS distance from start between 35% and 90% of the max, at least 8 tiles apart from each other and from the exit. Prefer dead ends: they reward exploration and add risk.
- **Aswang spawn:** at least 12 path tiles from the start, not on the shortest start-to-exit route.
- Guarantee solvability: every key, the exit, and each spawn must be reachable from the start. Fail the build otherwise.

## Validation script (run before seeding)
BFS from the start over `0` tiles. Assert: border is solid, all targets reachable, `KeysRequired <= keyCount`, map is rectangular, only known characters appear, exactly one `5` and one `3`.

## MinPossibleMs and stars
Use true walking distance, not guesses. With `speed` in tiles per second (sprint speed is the player's maximum, e.g. 4.5):
```
route = start -> best ordering of the KeysRequired keys -> exit   (try all permutations, keys <= 5)
minTiles = min over orderings of the sum of BFS distances along the route
MinPossibleMs = floor(minTiles / sprintSpeed * 1000 * 0.9)   // 10% tolerance so honest runs are never rejected
StarTime3 = minTiles / walkSpeed * 1000 * 1.1   // fast, near-optimal route with walking pace
StarTime2 = minTiles / walkSpeed * 1000 * 1.8   // comfortable exploration
```
Tune stars after real playtests: aim for roughly 10% of testers earning 3 stars, 40% earning 2 stars. Store these in the Levels table and in the seeder, never hard-coded in JS.

## Difficulty curve
| # | Name | Size | Keys | Aswang | Speed | Fog | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Barangay Eskinita | 15x15 | 2 | 1 | 0.9 | long | Tutorial, forgiving, teaches keys and sprint |
| 2 | Lumang Balay | 21x21 | 3 | 1 | 1.0 | medium | Rooms and doors, hiding corners |
| 3 | Sementeryo | 25x25 | 3 | 1 | 1.1 | short | Open space, long sight lines, dark |
| 4 | Kagubatan | 31x31 | 4 | 2 | 1.0 | short | Two hunters, loops are essential |
| 5 | Lungib sa Kapre | 31x31 | 5 | 2 + boss | 1.15 | very short | Final, one scripted event |
Change only one major variable per level so players feel the new threat. Unlock level N+1 only on escape from level N.

## Seeding into SQLite
Generate or paste the `MapData`, run the validator, compute the timing columns, then emit the C# seed entry. Prefer seeding by `Order` and updating existing rows if the map changes, so migrations are not needed for balance tweaks. Remember: changing a level's map invalidates old leaderboard times, so bump a `Version` column or clear that level's runs.

## Playtest questions
- Can a first-time player finish level 1 in under 3 minutes?
- Does every level have a loop near the start to teach circling?
- Is there ever a spot where the aswang spawns with line of sight to the player?
- Does any key sit on a tile only reachable through the enemy's patrol route with no alternative?
