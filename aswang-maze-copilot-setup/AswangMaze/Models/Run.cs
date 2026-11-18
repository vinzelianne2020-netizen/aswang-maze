namespace AswangMaze.Models;

public class Run
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public int LevelId { get; set; }
    public int TimeMs { get; set; }
    public int KeysCollected { get; set; }
    public bool Escaped { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
