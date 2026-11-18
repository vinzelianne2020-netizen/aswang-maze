using System.Security.Cryptography;
using System.Text;
using AswangMaze.Data;
using AswangMaze.Models;
using Microsoft.EntityFrameworkCore;

namespace AswangMaze.Services;

public static class Auth
{
    public static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static async Task<Player?> GetPlayerAsync(HttpRequest request, GameDb db)
    {
        if (!request.Headers.TryGetValue("Authorization", out var values))
            return null;

        var authorization = values.ToString();
        const string bearerPrefix = "Bearer ";
        if (!authorization.StartsWith(bearerPrefix, StringComparison.OrdinalIgnoreCase))
            return null;

        var token = authorization[bearerPrefix.Length..].Trim();
        if (token.Length == 0)
            return null;

        var hash = HashToken(token);
        return await db.Players.SingleOrDefaultAsync(player => player.TokenHash == hash);
    }
}
