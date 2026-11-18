import { bfs, findReachable } from "./pathfinding.js";

export const EnemyState = Object.freeze({
  PATROL: "PATROL",
  INVESTIGATE: "INVESTIGATE",
  CHASE: "CHASE",
  SEARCH: "SEARCH"
});

export class Aswang {
  constructor(map, spawn, levelSpeed, randomOffset = 0) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.facing = 0;
    this.baseSpeed = 1.15 * levelSpeed;
    this.state = EnemyState.PATROL;
    this.stateTime = 0;
    this.path = [];
    this.pathTimer = randomOffset;
    this.pathInterval = 0.3;
    this.viewDistance = 8;
    this.lastSeenX = this.x;
    this.lastSeenY = this.y;
    this.searchTime = 0;
    this.graceTime = 5;
    this.noisePoint = null;
    this.losCacheTime = 0;
    this.losCacheResult = false;
    this.map = map;
  }

  setState(nextState) {
    if (this.state === nextState) return;
    this.state = nextState;
    this.stateTime = 0;

    if (nextState === EnemyState.SEARCH) {
      this.searchTime = 0;
    }
  }

  emitNoise(x, y, radius) {
    if (this.state !== EnemyState.PATROL && this.state !== EnemyState.SEARCH) return;

    const startX = Math.floor(this.x);
    const startY = Math.floor(this.y);
    const targetX = Math.floor(x);
    const targetY = Math.floor(y);
    const path = bfs(this.map, startX, startY, targetX, targetY);
    if (path && path.length <= radius * 2) {
      this.noisePoint = { x, y };
      this.setState(EnemyState.INVESTIGATE);
    }
  }

  hasLineOfSight(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance > this.viewDistance) return false;

    const angleToPlayer = Math.atan2(dy, dx);
    let angleDifference = angleToPlayer - this.facing;
    while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
    while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;
    if (Math.abs(angleDifference) > Math.PI * 0.39) return false;

    const rayCount = Math.ceil(distance * 4);
    for (let index = 1; index < rayCount; index++) {
      const fraction = index / rayCount;
      const x = Math.floor(this.x + dx * fraction);
      const y = Math.floor(this.y + dy * fraction);
      if (this.map[y]?.[x] === 1) return false;
    }
    return true;
  }

  choosePatrolWaypoint() {
    const reachable = findReachable(this.map, Math.floor(this.x), Math.floor(this.y));
    if (reachable.length === 0) return null;

    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = reachable[Math.floor(Math.random() * reachable.length)];
      if (Math.hypot(candidate[0] + 0.5 - this.x, candidate[1] + 0.5 - this.y) > 3) {
        return { x: candidate[0] + 0.5, y: candidate[1] + 0.5 };
      }
    }
    return null;
  }

  update(dt, player, elapsedTime) {
    this.stateTime += dt;
    this.graceTime = Math.max(0, this.graceTime - dt);

    if (this.graceTime === 0) {
      this.losCacheTime -= dt;
      if (this.losCacheTime <= 0) {
        this.losCacheTime = 0.1;
        this.losCacheResult = this.hasLineOfSight(player);
      }

      if (this.losCacheResult) {
        this.lastSeenX = player.x;
        this.lastSeenY = player.y;
        this.setState(EnemyState.CHASE);
      } else if (this.state === EnemyState.CHASE) {
        this.setState(EnemyState.SEARCH);
      }
    }

    this.pathTimer -= dt;
    if (this.pathTimer <= 0) {
      this.pathTimer = this.pathInterval + Math.random() * 0.08;
      this.recalculatePath(player);
    }

    const speedMultiplier =
      this.state === EnemyState.PATROL ? 0.6 :
      this.state === EnemyState.INVESTIGATE ? 1.0 :
      this.state === EnemyState.CHASE ? 1.15 :
      0.8;

    this.moveAlongPath(speedMultiplier * this.baseSpeed, dt);

    if (this.state === EnemyState.PATROL && this.path.length === 0 && this.stateTime > 1) {
      const waypoint = this.choosePatrolWaypoint();
      if (waypoint) {
        this.path = bfs(
          this.map,
          Math.floor(this.x),
          Math.floor(this.y),
          Math.floor(waypoint.x),
          Math.floor(waypoint.y)
        ) || [];
      }
      this.stateTime = 0;
    }

    if (this.state === EnemyState.INVESTIGATE &&
        this.noisePoint &&
        Math.hypot(this.x - this.noisePoint.x, this.y - this.noisePoint.y) < 0.35) {
      this.noisePoint = null;
      this.setState(EnemyState.SEARCH);
    }

    if (this.state === EnemyState.SEARCH) {
      this.searchTime += dt;
      if (this.searchTime >= 5) this.setState(EnemyState.PATROL);
    }

    const caught = Math.hypot(this.x - player.x, this.y - player.y) < 0.5;
    return caught && this.graceTime === 0;
  }

  recalculatePath(player) {
    let targetX;
    let targetY;

    if (this.state === EnemyState.CHASE) {
      targetX = player.x;
      targetY = player.y;
    } else if (this.state === EnemyState.INVESTIGATE && this.noisePoint) {
      targetX = this.noisePoint.x;
      targetY = this.noisePoint.y;
    } else if (this.state === EnemyState.SEARCH) {
      targetX = this.lastSeenX;
      targetY = this.lastSeenY;
    } else {
      if (this.path.length > 0) return;
      const waypoint = this.choosePatrolWaypoint();
      if (!waypoint) return;
      targetX = waypoint.x;
      targetY = waypoint.y;
    }

    this.path = bfs(
      this.map,
      Math.floor(this.x),
      Math.floor(this.y),
      Math.floor(targetX),
      Math.floor(targetY)
    ) || [];
  }

  moveAlongPath(speed, dt) {
    while (this.path.length > 0) {
      const [tileX, tileY] = this.path[0];
      const targetX = tileX + 0.5;
      const targetY = tileY + 0.5;
      let dx = targetX - this.x;
      let dy = targetY - this.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.05) {
        this.path.shift();
        continue;
      }

      dx /= distance;
      dy /= distance;
      this.facing = Math.atan2(dy, dx);

      const movement = Math.min(speed * dt, distance);
      const nextX = this.x + dx * movement;
      const nextY = this.y + dy * movement;
      if (this.map[Math.floor(nextY)][Math.floor(nextX)] !== 1) {
        this.x = nextX;
        this.y = nextY;
      } else {
        this.path = [];
      }
      break;
    }
  }

  debugText() {
    return `${this.state} grace=${this.graceTime.toFixed(1)}s`;
  }
}
