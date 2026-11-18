namespace AswangMaze.Dtos;

public record ProgressDto(int LevelId, int? BestTimeMs, int Stars, bool Unlocked);
