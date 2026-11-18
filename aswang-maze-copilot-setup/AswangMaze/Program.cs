using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using AswangMaze.Data;
using AswangMaze.Dtos;
using AswangMaze.Models;
using AswangMaze.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<GameDb>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("runs", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Request.Headers.Authorization.ToString(),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var app = builder.Build();

app.UseDefaultFiles();
var staticFileProvider = new FileExtensionContentTypeProvider();
staticFileProvider.Mappings[".gltf"] = "model/gltf+json";
staticFileProvider.Mappings[".bin"] = "application/octet-stream";
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = staticFileProvider
});
app.UseRateLimiter();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<GameDb>();
    await db.Database.MigrateAsync();
    await Seed.RunAsync(db);
}

app.MapPost("/api/players", async (CreatePlayerRequest request, GameDb db) =>
{
    var username = request.Username?.Trim();
    if (!Regex.IsMatch(username ?? "", @"^[A-Za-z0-9_]{3,16}$"))
        return Results.BadRequest(new { error = "Username must be 3-16 characters using letters, digits, or underscore." });

    if (await db.Players.AsNoTracking().AnyAsync(player => player.Username == username))
        return Results.Json(new { error = "Username already exists." }, statusCode: StatusCodes.Status409Conflict);

    var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    var player = new Player
    {
        Username = username!,
        TokenHash = Auth.HashToken(token)
    };

    db.Players.Add(player);
    await db.SaveChangesAsync();

    var firstLevel = await db.Levels.OrderBy(level => level.Order).FirstOrDefaultAsync();
    if (firstLevel is not null)
    {
        db.Progress.Add(new Progress
        {
            PlayerId = player.Id,
            LevelId = firstLevel.Id,
            Stars = 0,
            Unlocked = true
        });
        await db.SaveChangesAsync();
    }

    return Results.Ok(new CreatePlayerResponse(player.Id, player.Username, token));
});

app.MapGet("/api/levels", async (HttpRequest request, GameDb db) =>
{
    var player = await Auth.GetPlayerAsync(request, db);
    if (player is null)
        return Results.Json(new { error = "Unauthorized." }, statusCode: StatusCodes.Status401Unauthorized);

    var levels = await db.Levels.AsNoTracking().OrderBy(level => level.Order).ToListAsync();
    var progress = await db.Progress.AsNoTracking()
        .Where(item => item.PlayerId == player.Id)
        .ToDictionaryAsync(item => item.LevelId);

    var response = levels.Select(level =>
        new LevelSummaryDto(
            level.Id,
            level.Name,
            level.Order,
            progress.TryGetValue(level.Id, out var item) && item.Unlocked));

    return Results.Ok(response);
});

app.MapGet("/api/levels/{id:int}", async (int id, HttpRequest request, GameDb db) =>
{
    var player = await Auth.GetPlayerAsync(request, db);
    if (player is null)
        return Results.Json(new { error = "Unauthorized." }, statusCode: StatusCodes.Status401Unauthorized);

    var level = await db.Levels.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id);
    if (level is null)
        return Results.NotFound(new { error = "Level not found." });

    var progress = await db.Progress.AsNoTracking()
        .SingleOrDefaultAsync(item => item.PlayerId == player.Id && item.LevelId == id);
    if (progress is null || !progress.Unlocked)
        return Results.Json(new { error = "Level is locked." }, statusCode: StatusCodes.Status403Forbidden);

    return Results.Ok(new LevelDto(
        level.Id,
        level.Name,
        level.Order,
        level.Width,
        level.Height,
        level.MapData,
        level.StartX,
        level.StartY,
        level.KeysRequired,
        level.EnemyCount,
        level.EnemySpeed,
        level.FogDistance,
        level.MinPossibleMs,
        level.StarTime3,
        level.StarTime2));
});

app.MapPost("/api/runs", async (SubmitRunRequest request, HttpRequest httpRequest, GameDb db) =>
{
    var player = await Auth.GetPlayerAsync(httpRequest, db);
    if (player is null)
        return Results.Json(new { error = "Unauthorized." }, statusCode: StatusCodes.Status401Unauthorized);

    var level = await db.Levels.AsNoTracking().SingleOrDefaultAsync(item => item.Id == request.LevelId);
    if (level is null)
        return Results.NotFound(new { error = "Level not found." });

    var progress = await db.Progress
        .SingleOrDefaultAsync(item => item.PlayerId == player.Id && item.LevelId == level.Id);
    if (progress is null || !progress.Unlocked)
        return Results.Json(new { error = "Level is locked." }, statusCode: StatusCodes.Status403Forbidden);

    if (request.TimeMs <= 0 || request.TimeMs > 6 * 60 * 60 * 1000)
        return Results.BadRequest(new { error = "TimeMs must be between 1 ms and 6 hours." });

    if (request.KeysCollected < 0 || request.KeysCollected > level.KeysRequired)
        return Results.BadRequest(new { error = $"KeysCollected must be between 0 and {level.KeysRequired}." });

    if (request.Escaped &&
        (request.KeysCollected < level.KeysRequired || request.TimeMs < level.MinPossibleMs))
    {
        return Results.BadRequest(new
        {
            error = "An escaped run must collect all keys and meet the minimum possible time."
        });
    }

    await using var transaction = await db.Database.BeginTransactionAsync();

    var run = new Run
    {
        PlayerId = player.Id,
        LevelId = level.Id,
        TimeMs = request.TimeMs,
        KeysCollected = request.KeysCollected,
        Escaped = request.Escaped
    };
    db.Runs.Add(run);

    int? bestTime = null;
    var stars = progress.Stars;

    if (request.Escaped)
    {
        bestTime = progress.BestTimeMs is null
            ? request.TimeMs
            : Math.Min(progress.BestTimeMs.Value, request.TimeMs);

        var runStars = request.TimeMs <= level.StarTime3
            ? 3
            : request.TimeMs <= level.StarTime2
                ? 2
                : 1;

        progress.BestTimeMs = bestTime;
        progress.Stars = Math.Max(progress.Stars, runStars);
        stars = progress.Stars;

        var nextLevel = await db.Levels
            .Where(item => item.Order == level.Order + 1)
            .SingleOrDefaultAsync();
        if (nextLevel is not null)
        {
            var nextProgress = await db.Progress
                .SingleOrDefaultAsync(item =>
                    item.PlayerId == player.Id &&
                    item.LevelId == nextLevel.Id);

            if (nextProgress is null)
            {
                db.Progress.Add(new Progress
                {
                    PlayerId = player.Id,
                    LevelId = nextLevel.Id,
                    Stars = 0,
                    Unlocked = true
                });
            }
            else
            {
                nextProgress.Unlocked = true;
            }
        }
    }

    await db.SaveChangesAsync();
    await transaction.CommitAsync();

    return Results.Ok(new RunResponseDto(
        run.Id,
        run.TimeMs,
        run.KeysCollected,
        run.Escaped,
        stars,
        progress.BestTimeMs));
}).RequireRateLimiting("runs");

app.MapGet("/api/leaderboard/{levelId:int}", async (int levelId, int? top, GameDb db) =>
{
    if (!await db.Levels.AsNoTracking().AnyAsync(level => level.Id == levelId))
        return Results.NotFound(new { error = "Level not found." });

    var limit = Math.Clamp(top ?? 10, 1, 50);
    var scores = await db.Runs
        .AsNoTracking()
        .Where(run => run.LevelId == levelId && run.Escaped)
        .GroupBy(run => run.PlayerId)
        .Select(group => new
        {
            PlayerId = group.Key,
            TimeMs = group.Min(run => run.TimeMs)
        })
        .OrderBy(score => score.TimeMs)
        .Take(limit)
        .Join(
            db.Players,
            score => score.PlayerId,
            player => player.Id,
            (score, player) => new LeaderboardEntryDto(player.Username, score.TimeMs))
        .ToListAsync();

    return Results.Ok(scores);
});

app.MapGet("/api/players/me/progress", async (HttpRequest request, GameDb db) =>
{
    var player = await Auth.GetPlayerAsync(request, db);
    if (player is null)
        return Results.Json(new { error = "Unauthorized." }, statusCode: StatusCodes.Status401Unauthorized);

    var progress = await db.Progress
        .AsNoTracking()
        .Where(item => item.PlayerId == player.Id)
        .Join(
            db.Levels,
            item => item.LevelId,
            level => level.Id,
            (item, level) => new { Item = item, level.Order })
        .OrderBy(item => item.Order)
        .Select(item => new ProgressDto(
            item.Item.LevelId,
            item.Item.BestTimeMs,
            item.Item.Stars,
            item.Item.Unlocked))
        .ToListAsync();

    return Results.Ok(progress);
});

app.Run();
