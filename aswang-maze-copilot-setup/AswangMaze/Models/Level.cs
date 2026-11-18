namespace AswangMaze.Models;

public class Level
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int Order { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public string MapData { get; set; } = "";
    public int StartX { get; set; }
    public int StartY { get; set; }
    public int KeysRequired { get; set; }
    public int EnemyCount { get; set; }
    public double EnemySpeed { get; set; }
    public double FogDistance { get; set; }
    public int MinPossibleMs { get; set; }
    public int StarTime3 { get; set; }
    public int StarTime2 { get; set; }
}
