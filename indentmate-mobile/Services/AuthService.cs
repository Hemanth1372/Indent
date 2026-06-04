using IndentMate.Mobile.Data;

namespace IndentMate.Mobile.Services;

/// <summary>
/// Manages authentication: PIN validation, auto-logout timer, responsibility checks.
/// </summary>
public class AuthService
{
    private readonly DatabaseService _db;
    private System.Timers.Timer? _autoLogoutTimer;
    private const int AutoLogoutMinutes = 5;

    public bool IsLoggedIn { get; private set; }
    public string? CurrentEngineerId { get; private set; }
    public string? EngineerType { get; private set; } // "SIE" or "SER"

    public event EventHandler? SessionExpired;

    public AuthService(DatabaseService db)
    {
        _db = db;
    }

    /// <summary>
    /// Validates PIN against stored hash for the given engineer ID.
    /// Returns true on success; starts auto-logout timer.
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
            StartAutoLogoutTimer();
        }
        return valid;
    }

    /// <summary>Resets the auto-logout timer on any user activity.</summary>
    public void ResetActivityTimer()
    {
        _autoLogoutTimer?.Stop();
        _autoLogoutTimer?.Start();
    }

    public void Logout()
    {
        IsLoggedIn = false;
        CurrentEngineerId = null;
        EngineerType = null;
        _autoLogoutTimer?.Stop();
    }

    private void StartAutoLogoutTimer()
    {
        _autoLogoutTimer?.Dispose();
        _autoLogoutTimer = new System.Timers.Timer(TimeSpan.FromMinutes(AutoLogoutMinutes).TotalMilliseconds);
        _autoLogoutTimer.Elapsed += (_, _) =>
        {
            Logout();
            SessionExpired?.Invoke(this, EventArgs.Empty);
        };
        _autoLogoutTimer.AutoReset = false;
        _autoLogoutTimer.Start();
    }

    private static string ComputeHash(string input)
    {
        // TODO: Use BCrypt or PBKDF2 — this is a placeholder
        using var sha = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(input);
        return Convert.ToBase64String(sha.ComputeHash(bytes));
    }
}
