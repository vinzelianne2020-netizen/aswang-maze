using AswangMaze.Models;
using Microsoft.EntityFrameworkCore;

namespace AswangMaze.Data;

public class GameDb(DbContextOptions<GameDb> options) : DbContext(options)
{
    public DbSet<Player> Players => Set<Player>();
    public DbSet<Level> Levels => Set<Level>();
    public DbSet<Run> Runs => Set<Run>();
    public DbSet<Progress> Progress => Set<Progress>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<Player>()
            .HasIndex(player => player.Username)
            .IsUnique();

        builder.Entity<Progress>()
            .HasKey(progress => new { progress.PlayerId, progress.LevelId });

        builder.Entity<Run>()
            .HasIndex(run => new { run.LevelId, run.Escaped, run.TimeMs });

        builder.Entity<Run>()
            .HasOne<Player>()
            .WithMany()
            .HasForeignKey(run => run.PlayerId);

        builder.Entity<Run>()
            .HasOne<Level>()
            .WithMany()
            .HasForeignKey(run => run.LevelId);

        builder.Entity<Progress>()
            .HasOne<Player>()
            .WithMany()
            .HasForeignKey(progress => progress.PlayerId);

        builder.Entity<Progress>()
            .HasOne<Level>()
            .WithMany()
            .HasForeignKey(progress => progress.LevelId);
    }
}
