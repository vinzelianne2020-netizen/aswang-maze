namespace AswangMaze.Dtos;

public record CreatePlayerRequest(string? Username);

public record CreatePlayerResponse(int Id, string Username, string Token);
