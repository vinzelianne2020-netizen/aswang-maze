namespace AswangMaze.Dtos;

public record SubmitRunRequest(int LevelId, int TimeMs, int KeysCollected, bool Escaped);

public record RunResponseDto(int Id, int TimeMs, int KeysCollected, bool Escaped, int Stars, int? BestTimeMs);
