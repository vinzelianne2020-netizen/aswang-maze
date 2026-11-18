namespace AswangMaze.Dtos;

public record LevelSummaryDto(int Id, string Name, int Order, bool Unlocked);

public record LevelDto(
    int Id,
    string Name,
    int Order,
    int Width,
    int Height,
    string MapData,
    int StartX,
    int StartY,
    int KeysRequired,
    int EnemyCount,
    double EnemySpeed,
    double FogDistance,
    int MinPossibleMs,
    int StarTime3,
    int StarTime2);
