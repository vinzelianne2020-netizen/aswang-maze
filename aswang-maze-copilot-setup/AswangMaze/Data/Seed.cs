using AswangMaze.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AswangMaze.Data;

public static class Seed
{
    private sealed record GeneratedPoint(int X, int Y);
    private sealed record GeneratedLevel(
        int Order,
        string Name,
        int Width,
        int Height,
        int Keys,
        int Enemies,
        double EnemySpeed,
        double Fog,
        string MapData,
        GeneratedPoint Start,
        int MinPossibleMs,
        int StarTime3,
        int StarTime2);

    private const string BaseMapData =
        "111111111111111\n" +
        "150000000000001\n" +
        "101111011111101\n" +
        "100010010002001\n" +
        "111010010101101\n" +
        "100010000101001\n" +
        "101011111101101\n" +
        "101000000001001\n" +
        "101111011111101\n" +
        "100004010000001\n" +
        "101111010111101\n" +
        "100000000100001\n" +
        "101111111101101\n" +
        "100020000003001\n" +
        "111111111111111";

    public static async Task RunAsync(GameDb db)
    {
        var levels = new List<Level> { ValidateAndCreateLevel() };
        var reportPath = Path.Combine(AppContext.BaseDirectory, "generated", "level-report.json");
        if (File.Exists(reportPath))
        {
            var json = await File.ReadAllTextAsync(reportPath);
            var generated = JsonSerializer.Deserialize<GeneratedLevel[]>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (generated is null)
                throw new InvalidDataException("Generated level report is empty or invalid.");
            levels.AddRange(generated.Select(ValidateAndCreateGeneratedLevel));
        }

        foreach (var level in levels)
        {
            var existing = await db.Levels.SingleOrDefaultAsync(item => item.Order == level.Order);
            if (existing is null)
            {
                db.Levels.Add(level);
            }
            else
            {
                level.Id = existing.Id;
                db.Entry(existing).CurrentValues.SetValues(level);
            }
        }

        await db.SaveChangesAsync();
    }

    private static Level ValidateAndCreateGeneratedLevel(GeneratedLevel source)
    {
        var rows = source.MapData.Split('\n');
        if (rows.Length != source.Height || rows.Any(row => row.Length != source.Width))
            throw new InvalidDataException($"Level {source.Order} has invalid map dimensions.");
        if (rows[0].Any(tile => tile != '1') || rows[^1].Any(tile => tile != '1') ||
            rows.Any(row => row[0] != '1' || row[^1] != '1'))
            throw new InvalidDataException($"Level {source.Order} must have solid borders.");
        if (rows.Any(row => row.Any(tile => !"012345".Contains(tile))))
            throw new InvalidDataException($"Level {source.Order} contains an unknown map tile.");

        var starts = FindTiles(rows, '5');
        var exits = FindTiles(rows, '3');
        var keys = FindTiles(rows, '2');
        var enemies = FindTiles(rows, '4');
        if (starts.Count != 1 || exits.Count != 1 ||
            keys.Count != source.Keys || enemies.Count != source.Enemies ||
            starts[0] != (source.Start.X, source.Start.Y))
            throw new InvalidDataException($"Level {source.Order} has invalid entity placements.");

        var reachable = Distances(rows, starts[0]);
        if (exits.Concat(keys).Concat(enemies).Any(target => !reachable.ContainsKey(target)))
            throw new InvalidDataException($"Level {source.Order} contains an unreachable entity.");

        return new Level
        {
            Name = source.Name,
            Order = source.Order,
            Width = source.Width,
            Height = source.Height,
            MapData = source.MapData,
            StartX = source.Start.X,
            StartY = source.Start.Y,
            KeysRequired = source.Keys,
            EnemyCount = source.Enemies,
            EnemySpeed = source.EnemySpeed,
            FogDistance = source.Fog,
            MinPossibleMs = source.MinPossibleMs,
            StarTime3 = source.StarTime3,
            StarTime2 = source.StarTime2
        };
    }

    private static Level ValidateAndCreateLevel()
    {
        var baseRows = BaseMapData.Split('\n');
        if (baseRows.Length != 15 || baseRows.Any(row => row.Length != 15))
            throw new InvalidOperationException("Level 1 source map must be exactly 15x15.");

        var rows = ExpandMap(BaseMapData, scale: 3);
        var height = rows.Length;
        var width = rows[0].Length;

        if (rows.Any(row => row.Length != width))
            throw new InvalidOperationException("Level 1 map rows must have equal width.");

        for (var x = 0; x < width; x++)
        {
            if (rows[0][x] != '1' || rows[height - 1][x] != '1')
                throw new InvalidOperationException("Level 1 map needs solid horizontal borders.");
        }

        for (var y = 0; y < height; y++)
        {
            if (rows[y][0] != '1' || rows[y][width - 1] != '1')
                throw new InvalidOperationException("Level 1 map needs solid vertical borders.");

            foreach (var tile in rows[y])
                if (!"012345".Contains(tile))
                    throw new InvalidOperationException("Level 1 map contains an unknown tile.");
        }

        var starts = FindTiles(rows, '5');
        var exits = FindTiles(rows, '3');
        var keys = FindTiles(rows, '2');
        var enemies = FindTiles(rows, '4');

        if (starts.Count != 1 || exits.Count != 1 || keys.Count != 2 || enemies.Count != 1)
            throw new InvalidOperationException("Level 1 must contain exactly one start, exit, aswang, and two keys.");

        var distancesFromStart = Distances(rows, starts[0]);
        foreach (var target in exits.Concat(keys).Concat(enemies))
        {
            if (!distancesFromStart.ContainsKey(target))
                throw new InvalidOperationException("Level 1 contains an unreachable target.");
        }

        var shortestRoute = ShortestKeyRoute(rows, starts[0], exits[0], keys);
        var minPossibleMs = (int)Math.Floor(shortestRoute / 4.5 * 1000 * 0.9);
        var starTime3 = (int)Math.Floor(shortestRoute / 2.8 * 1000 * 1.1);
        var starTime2 = (int)Math.Floor(shortestRoute / 2.8 * 1000 * 1.8);

        return new Level
        {
            Name = "Barangay Eskinita",
            Order = 1,
            Width = width,
            Height = height,
            MapData = string.Join('\n', rows),
            StartX = starts[0].X,
            StartY = starts[0].Y,
            KeysRequired = 2,
            EnemyCount = 1,
            EnemySpeed = 1.25,
            FogDistance = 16,
            MinPossibleMs = minPossibleMs,
            StarTime3 = starTime3,
            StarTime2 = starTime2
        };
    }

    private static string[] ExpandMap(string mapData, int scale)
    {
        var sourceRows = mapData.Split('\n');
        var expandedRows = new string[sourceRows.Length * scale];

        for (var y = 0; y < sourceRows.Length; y++)
        {
            for (var rowOffset = 0; rowOffset < scale; rowOffset++)
            {
                var expandedRow = new char[sourceRows[y].Length * scale];

                for (var x = 0; x < sourceRows[y].Length; x++)
                {
                    var tile = sourceRows[y][x];
                    var expandedTile = tile == '1' ? '1' : '0';
                    for (var offset = 0; offset < scale; offset++)
                        expandedRow[x * scale + offset] = expandedTile;

                    if (rowOffset == 0 && tile != '0' && tile != '1')
                        expandedRow[x * scale] = tile;
                }

                expandedRows[y * scale + rowOffset] = new string(expandedRow);
            }
        }

        return expandedRows;
    }

    private static List<(int X, int Y)> FindTiles(string[] rows, char tile)
    {
        var found = new List<(int X, int Y)>();
        for (var y = 0; y < rows.Length; y++)
            for (var x = 0; x < rows[y].Length; x++)
                if (rows[y][x] == tile)
                    found.Add((x, y));
        return found;
    }

    private static Dictionary<(int X, int Y), int> Distances(string[] rows, (int X, int Y) start)
    {
        var result = new Dictionary<(int X, int Y), int>();
        var queue = new Queue<(int X, int Y)>();
        result[start] = 0;
        queue.Enqueue(start);

        while (queue.Count > 0)
        {
            var (x, y) = queue.Dequeue();
            foreach (var (dx, dy) in new[] { (0, 1), (1, 0), (0, -1), (-1, 0) })
            {
                var next = (X: x + dx, Y: y + dy);
                if (next.Y < 0 || next.Y >= rows.Length || next.X < 0 || next.X >= rows[next.Y].Length)
                    continue;
                if (rows[next.Y][next.X] == '1' || result.ContainsKey(next))
                    continue;

                result[next] = result[(x, y)] + 1;
                queue.Enqueue(next);
            }
        }

        return result;
    }

    private static int ShortestKeyRoute(
        string[] rows,
        (int X, int Y) start,
        (int X, int Y) exit,
        List<(int X, int Y)> keys)
    {
        var startToFirst = Distances(rows, start);
        var keyDistances = keys.ToDictionary(
            key => key,
            key => Distances(rows, key));

        var first = keys[0];
        var second = keys[1];
        var routeOne =
            startToFirst[first] +
            keyDistances[first][second] +
            keyDistances[second][exit];
        var routeTwo =
            startToFirst[second] +
            keyDistances[second][first] +
            keyDistances[first][exit];

        return Math.Min(routeOne, routeTwo);
    }
}
