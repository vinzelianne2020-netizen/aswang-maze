namespace AswangMaze.Models;

public class Progress
{
    public int PlayerId { get; set; }
    public int LevelId { get; set; }
    public int? BestTimeMs { get; set; }
    public int Stars { get; set; }
    public bool Unlocked { get; set; }
}
