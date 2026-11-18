using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AswangMaze.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Levels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Order = table.Column<int>(type: "INTEGER", nullable: false),
                    Width = table.Column<int>(type: "INTEGER", nullable: false),
                    Height = table.Column<int>(type: "INTEGER", nullable: false),
                    MapData = table.Column<string>(type: "TEXT", nullable: false),
                    StartX = table.Column<int>(type: "INTEGER", nullable: false),
                    StartY = table.Column<int>(type: "INTEGER", nullable: false),
                    KeysRequired = table.Column<int>(type: "INTEGER", nullable: false),
                    EnemyCount = table.Column<int>(type: "INTEGER", nullable: false),
                    EnemySpeed = table.Column<double>(type: "REAL", nullable: false),
                    FogDistance = table.Column<double>(type: "REAL", nullable: false),
                    MinPossibleMs = table.Column<int>(type: "INTEGER", nullable: false),
                    StarTime3 = table.Column<int>(type: "INTEGER", nullable: false),
                    StarTime2 = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Levels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Players",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Username = table.Column<string>(type: "TEXT", nullable: false),
                    TokenHash = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Players", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Progress",
                columns: table => new
                {
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    LevelId = table.Column<int>(type: "INTEGER", nullable: false),
                    BestTimeMs = table.Column<int>(type: "INTEGER", nullable: true),
                    Stars = table.Column<int>(type: "INTEGER", nullable: false),
                    Unlocked = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Progress", x => new { x.PlayerId, x.LevelId });
                    table.ForeignKey(
                        name: "FK_Progress_Levels_LevelId",
                        column: x => x.LevelId,
                        principalTable: "Levels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Progress_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Runs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    LevelId = table.Column<int>(type: "INTEGER", nullable: false),
                    TimeMs = table.Column<int>(type: "INTEGER", nullable: false),
                    KeysCollected = table.Column<int>(type: "INTEGER", nullable: false),
                    Escaped = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Runs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Runs_Levels_LevelId",
                        column: x => x.LevelId,
                        principalTable: "Levels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Runs_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Players_Username",
                table: "Players",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Progress_LevelId",
                table: "Progress",
                column: "LevelId");

            migrationBuilder.CreateIndex(
                name: "IX_Runs_LevelId_Escaped_TimeMs",
                table: "Runs",
                columns: new[] { "LevelId", "Escaped", "TimeMs" });

            migrationBuilder.CreateIndex(
                name: "IX_Runs_PlayerId",
                table: "Runs",
                column: "PlayerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Progress");

            migrationBuilder.DropTable(
                name: "Runs");

            migrationBuilder.DropTable(
                name: "Levels");

            migrationBuilder.DropTable(
                name: "Players");
        }
    }
}
