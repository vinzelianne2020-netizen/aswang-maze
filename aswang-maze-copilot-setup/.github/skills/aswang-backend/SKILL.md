---
name: aswang-backend
description: Build and harden the ASP.NET Core 8 Minimal API, EF Core and SQLite backend for the Aswang Maze game, including project setup, models, migrations, seeding, token auth, run submission, leaderboards, anti-cheat validation, rate limiting, static file hosting, and deployment with a persistent SQLite volume. Use this skill whenever the user touches C#, DbContext, migrations, endpoints, scores, leaderboard queries, tokens, anti-cheat, Dockerfile, hosting, or says the API or database is broken, even if they only mention "the backend" or "saving scores".
---

# Backend (Phases 0, 1 and deploy)

Stack: .NET 8, Minimal API, EF Core 8, SQLite. One project serves `wwwroot` and `/api/*`.

## Setup
```bash
dotnet new web -n AswangMaze && cd AswangMaze
dotnet add package Microsoft.EntityFrameworkCore.Sqlite --version 8.*
dotnet add package Microsoft.EntityFrameworkCore.Design --version 8.*
dotnet tool install --global dotnet-ef
```
`.gitignore` must include `bin/ obj/ *.db *.db-shm *.db-wal`.

## Models
```csharp
public class Player { public int Id {get;set;} public string Username {get;set;} = ""; public string TokenHash {get;set;} = ""; public DateTime CreatedAt {get;set;} = DateTime.UtcNow; }
public class Level  { public int Id {get;set;} public string Name {get;set;} = ""; public int Order {get;set;} public int Width {get;set;} public int Height {get;set;}
  public string MapData {get;set;} = ""; public int KeysRequired {get;set;} public int EnemyCount {get;set;} public double EnemySpeed {get;set;} public double FogDistance {get;set;}
  public int MinPossibleMs {get;set;} public int StarTime3 {get;set;} public int StarTime2 {get;set;} }
public class Run { public int Id {get;set;} public int PlayerId {get;set;} public int LevelId {get;set;} public int TimeMs {get;set;} public int KeysCollected {get;set;} public bool Escaped {get;set;} public DateTime CreatedAt {get;set;} = DateTime.UtcNow; }
public class Progress { public int PlayerId {get;set;} public int LevelId {get;set;} public int? BestTimeMs {get;set;} public int Stars {get;set;} public bool Unlocked {get;set;} }
```
DbContext essentials:
```csharp
protected override void OnModelCreating(ModelBuilder b) {
  b.Entity<Player>().HasIndex(p => p.Username).IsUnique();
  b.Entity<Progress>().HasKey(p => new { p.PlayerId, p.LevelId });
  b.Entity<Run>().HasIndex(r => new { r.LevelId, r.Escaped, r.TimeMs });
}
```
Register with `builder.Services.AddDbContext<GameDb>(o => o.UseSqlite(cfg.GetConnectionString("Default")))`. Apply migrations at startup (`db.Database.Migrate()`) then call the seeder, so a fresh deploy is self-initializing.

## Token auth (simple guest login)
- `POST /api/players`: validate username (3 to 16 chars, `^[A-Za-z0-9_]+$`), generate `Convert.ToHexString(RandomNumberGenerator.GetBytes(32))`, store `SHA256(token)`, return the raw token **once**. Duplicate username returns 409.
- Clients send `Authorization: Bearer <token>`. Auth helper hashes the header token and looks up the player.
- This is intentionally lightweight. Mention to the user that it is guest auth (losing the token loses the account) and offer a recovery code feature later.

## Run submission and anti-cheat
Never trust the client. In `POST /api/runs`:
1. Authenticate, load level (404 if missing).
2. Reject if the level is locked for this player (`Progress.Unlocked == false` and `Order > 1`).
3. If `Escaped`: require `KeysCollected >= level.KeysRequired` and `TimeMs >= level.MinPossibleMs` and `TimeMs <= 6 hours`. Otherwise 400.
4. Reject non-positive times and keys above the level's real key count.
5. Insert the run, then in the same transaction update `Progress`: best time = min, stars from `StarTime3`/`StarTime2`, unlock the next level by `Order`.
6. Rate limit: 10 runs/minute/player.
```csharp
builder.Services.AddRateLimiter(o => o.AddFixedWindowLimiter("runs", w => { w.PermitLimit = 10; w.Window = TimeSpan.FromMinutes(1); }));
app.UseRateLimiter();
app.MapPost("/api/runs", handler).RequireRateLimiting("runs");
```
Be honest with the user: client-side games cannot be made fully cheat-proof. These checks stop casual tampering. For stronger protection, add a server-issued `runId` at start, check elapsed server time against `TimeMs`, and optionally record input replays.

## Leaderboard query
Best escape per player per level, fastest first:
```csharp
var top = await db.Runs.Where(r => r.LevelId == id && r.Escaped)
  .GroupBy(r => r.PlayerId)
  .Select(g => new { PlayerId = g.Key, Best = g.Min(r => r.TimeMs) })
  .OrderBy(x => x.Best).Take(Math.Clamp(top, 1, 50))
  .Join(db.Players, x => x.PlayerId, p => p.Id, (x, p) => new { p.Username, TimeMs = x.Best })
  .ToListAsync();
```
Add `AsNoTracking()` on read endpoints. Return DTOs, never entities (they contain `TokenHash`).

## Static files and routing
```csharp
app.UseDefaultFiles(); app.UseStaticFiles();
```
Put these before the API mappings. Set cache headers for `/assets` (long) and `index.html` (no-cache).

## Deployment
- `dotnet publish -c Release -o out`.
- Docker: multi-stage build (`sdk:8.0` to `aspnet:8.0`), expose 8080, set `ASPNETCORE_URLS=http://+:8080`.
- Put the DB on a mounted volume: `ConnectionStrings__Default=Data Source=/data/aswangmaze.db`. Without a volume the database resets on every deploy.
- Enable WAL (`PRAGMA journal_mode=WAL;`) for concurrent reads.
- HTTPS is required for pointer lock on most hosts; terminate TLS at the platform.
- Back up the `.db` file on a schedule (copy while using `VACUUM INTO` to get a consistent snapshot).

## Debug checklist
| Symptom | Cause |
|---|---|
| `no such table` | Migrations not applied |
| 401 on everything | Token header not sent or hashed differently on create vs lookup |
| Leaderboard slow | Missing composite index |
| Data lost after deploy | SQLite file not on a persistent volume |
| Pointer lock refused in production | Not HTTPS, or lock requested outside a user gesture |
