using IndentMate.Mobile.Data;

namespace IndentMate.Mobile.Services;

/// <summary>
/// Manages authentication: PIN validation and responsibility checks.
/// </summary>
public class AuthService
{
    private readonly DatabaseService _db;

    public bool IsLoggedIn { get; private set; }
    public string? CurrentEngineerId { get; private set; }
    public string? EngineerType { get; private set; } // "SIE" or "SER"

    public AuthService(DatabaseService db)
    {
        _db = db;
    }

    /// <summary>
    /// Validates PIN against stored hash for the given engineer ID.
    /// </summary>
    public async Task<bool> ValidatePinAsync(string engineerId, string pin)
    {
        // Load engineer from local SQLite, compare SHA-256 hash of PIN
        var engineer = await _db.GetEngineerAsync(engineerId);
        if (engineer is null) return false;

        // TODO: Replace with proper hash comparison
        bool valid = engineer.PinHash == ComputeHash(pin);
        if (valid)
        {
            IsLoggedIn = true;
            CurrentEngineerId = engineerId;
            EngineerType = engineer.ResponsibilityCode; // SIE or SER
        }
        return valid;
    }

    /// <summary>Kept for compatibility; inactivity logout is disabled.</summary>
    public void ResetActivityTimer()
    {
    }

    public void Logout()
    {
        IsLoggedIn = false;
        CurrentEngineerId = null;
        EngineerType = null;
    }

    private static string ComputeHash(string input)
    {
        // TODO: Use BCrypt or PBKDF2 — this is a placeholder
        using var sha = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(input);
        return Convert.ToBase64String(sha.ComputeHash(bytes));
    }
}
