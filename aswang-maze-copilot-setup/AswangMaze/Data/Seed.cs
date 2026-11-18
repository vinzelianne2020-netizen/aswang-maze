using AswangMaze.Models;
using Microsoft.EntityFrameworkCore;

namespace AswangMaze.Data;

public static class Seed
{
    private const string MapData =
        "111111111111111\n" +
        "150000000000001\n" +
        "101111011111101\n" +
        "100010010001001\n" +
        "111010010101101\n" +
        "100010000101001\n" +
        "101011111101101\n" +
        "101000000001001\n" +
        "101111011111101\n" +
        "100004010000001\n" +
        "101111010111101\n" +
        "100000000100001\n" +
        "101111111101101\n" +
        "100020020003001\n" +
        "111111111111111";

    public static async Task RunAsync(GameDb db)
    {
        var level = ValidateAndCreateLevel();
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

        await db.SaveChangesAsync();
    }

    private static Level ValidateAndCreateLevel()
    {
        var rows = MapData.Split('\n');
        const int width = 15;
        const int height = 15;

        if (rows.Length != height || rows.Any(row => row.Length != width))
            throw new InvalidOperationException("Level 1 map must be exactly 15x15.");

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
            MapData = MapData,
            StartX = starts[0].X,
            StartY = starts[0].Y,
            KeysRequired = 2,
            EnemyCount = 1,
            EnemySpeed = 0.9,
            FogDistance = 8,
            MinPossibleMs = minPossibleMs,
            StarTime3 = starTime3,
            StarTime2 = starTime2
        };
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
