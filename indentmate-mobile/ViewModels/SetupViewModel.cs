using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;

namespace IndentMate.Mobile.ViewModels;

/// <summary>
/// ViewModel for initial setup screen.
/// Handles local-first setup while LN connectivity is unavailable.
/// </summary>
public partial class SetupViewModel : BaseViewModel
{
    private const string DeviceSetupCompleteKey = "indentmate_device_setup_complete";
    private readonly DatabaseService _databaseService;
    private readonly HttpClient _httpClient;

    [ObservableProperty] private string _lnEnvironment = "TST";
    [ObservableProperty] private string _company = string.Empty;
    [ObservableProperty] private string _engineerId = string.Empty;
    [ObservableProperty] private string _pin = string.Empty;
    [ObservableProperty] private bool _isPinVisible;
    [ObservableProperty] private string _errorMessage = string.Empty;
    [ObservableProperty] private LNEnvironmentOption? _selectedLNEnvironmentOption;

    public bool IsPinHidden => !IsPinVisible;

    public List<LNEnvironmentOption> LNEnvironmentOptions { get; } = new()
    {
        new("PRD", "PRD – Production"),
        new("TRN", "TRN – Training"),
        new("TST", "TST – Test")
    };

    public SetupViewModel()
    {
        _databaseService = new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db"));
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(ApiEndpoints.CurrentBaseUrl),
            Timeout = TimeSpan.FromSeconds(10)
        };
        SelectedLNEnvironmentOption = LNEnvironmentOptions.First(option => option.Code == LnEnvironment);
    }

    [RelayCommand]
    private async Task SaveAndSyncAsync()
    {
        if (IsBusy)
        {
            return;
        }

        try
        {
            IsBusy = true;
            HasError = false;
            ErrorMessage = string.Empty;
            StatusMessage = string.Empty;

            // Validate inputs
            if (string.IsNullOrWhiteSpace(LnEnvironment))
                throw new InvalidOperationException("LN Environment is required (PRD, TRN, TST).");

            if (string.IsNullOrWhiteSpace(Company))
                throw new InvalidOperationException("Company code is required (e.g., 100).");

            var normalizedEngineerId = EngineerId.Trim();

            if (string.IsNullOrWhiteSpace(normalizedEngineerId))
                throw new InvalidOperationException("Engineer ID is required.");

            if (string.IsNullOrWhiteSpace(Pin) || Pin.Length < 6)
                throw new InvalidOperationException("PIN must be 6 digits.");

            StatusMessage = "Checking User Master access...";
            var adminUser = await SyncPinToAdminApiAsync(normalizedEngineerId, Pin);

            StatusMessage = "Saving local configuration...";
            var pinHash = LNApiService.ComputeSHA256Hash(Pin);
            await SecureStorage.Default.SetAsync("ln_environment", LnEnvironment);
            await SecureStorage.Default.SetAsync("company", Company);
            await SecureStorage.Default.SetAsync("engineer_id", normalizedEngineerId);
            await SecureStorage.Default.SetAsync("engineer_name", adminUser.EmployeeName);
            await SecureStorage.Default.SetAsync("pin_hash", pinHash);
            SecureStorage.Default.Remove("jwt_token");
            Preferences.Default.Set(DeviceSetupCompleteKey, true);

            var responsibilityCode = NormalizeRole(adminUser.PrimaryRole);

            if (responsibilityCode is not ("SER" or "SIE" or "PRI"))
            {
                throw new InvalidOperationException("Access Denied: No valid SIE/SER/Project Incharge role assigned to this user.");
            }

            var engineer = new LocalEngineer
            {
                EngineerId = normalizedEngineerId,
                Name = adminUser.EmployeeName,
                PinHash = pinHash,
                LNEnvironment = LnEnvironment,
                Company = Company,
                ResponsibilityCode = responsibilityCode,
                LastSyncAt = DateTime.UtcNow
            };
            await _databaseService.SaveAsync(engineer);
            await SecureStorage.Default.SetAsync("user_role", responsibilityCode);

            await Shell.Current.GoToAsync("//login");
        }
        catch (Exception ex)
        {
            HasError = true;
            ErrorMessage = ex.Message;
            StatusMessage = string.Empty;
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task<AdminUserResponse> SyncPinToAdminApiAsync(string engineerId, string pin)
    {
        Exception? lastConnectionError = null;

        foreach (var baseUrl in ApiEndpoints.CandidateBaseUrls)
        {
            try
            {
                StatusMessage = "Syncing PIN to admin portal...";
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(12));
                var response = await _httpClient.PostAsJsonAsync(new Uri(new Uri(baseUrl), "/api/users/sync-pin"), new
                {
                    login_name = engineerId,
                    employee_name = engineerId,
                    current_pin = pin
                }, timeout.Token);

                if (response.StatusCode == HttpStatusCode.NotFound)
                {
                    throw new InvalidOperationException("No login ID found in User Master.");
                }

                if (!response.IsSuccessStatusCode)
                {
                    throw new InvalidOperationException("Could not verify this user in User Master.");
                }

                var syncResponse = await response.Content.ReadFromJsonAsync<SyncPinResponse>();
                var user = syncResponse?.User ?? syncResponse?.Data;

                if (user is null)
                {
                    throw new InvalidOperationException("Could not verify this user in User Master.");
                }

                user.EmployeeName = string.IsNullOrWhiteSpace(user.EmployeeName)
                    ? engineerId
                    : user.EmployeeName.Trim();

                ApiEndpoints.SetActiveBaseUrl(baseUrl);
                return user;
            }
            catch (InvalidOperationException)
            {
                throw;
            }
            catch (Exception ex) when (ex is TaskCanceledException or HttpRequestException)
            {
                lastConnectionError = ex;
            }
        }

        throw lastConnectionError is TaskCanceledException
            ? new InvalidOperationException("Could not connect to User Master within 12 seconds. Please check the admin API URL and network.")
            : new InvalidOperationException("Could not connect to User Master. Please check the admin API URL and network.");
    }

    partial void OnSelectedLNEnvironmentOptionChanged(LNEnvironmentOption? value)
    {
        if (value is not null)
        {
            LnEnvironment = value.Code;
        }
    }

    [RelayCommand]
    private void TogglePinVisibility()
    {
        IsPinVisible = !IsPinVisible;
    }

    partial void OnIsPinVisibleChanged(bool value)
    {
        OnPropertyChanged(nameof(IsPinHidden));
    }

    private static string NormalizeRole(string? role)
    {
        var normalizedRole = (role ?? string.Empty).Trim().ToUpperInvariant();

        if (
            normalizedRole is "SER" or "SRE" ||
            normalizedRole.Contains("(SER)") ||
            normalizedRole.Contains("(SRE)") ||
            normalizedRole.Contains("SERVICE ENGINEER") ||
            normalizedRole.Contains("SITE RECEIVING"))
        {
            return "SER";
        }

        if (
            normalizedRole is "SIE" ||
            normalizedRole.Contains("(SIE)") ||
            normalizedRole.Contains("SITE ENGINEER"))
        {
            return "SIE";
        }

        if (
            normalizedRole is "PRI" ||
            normalizedRole.Contains("(PRI)") ||
            normalizedRole.Contains("PROJECT INCHARGE"))
        {
            return "PRI";
        }

        return string.Empty;
    }
}

public record LNEnvironmentOption(string Code, string DisplayName);

public sealed class SyncPinResponse
{
    [JsonPropertyName("data")]
    public AdminUserResponse? Data { get; set; }

    [JsonPropertyName("user")]
    public AdminUserResponse? User { get; set; }
}

public sealed class AdminUserResponse
{
    [JsonPropertyName("employee_name")]
    public string EmployeeName { get; set; } = string.Empty;

    [JsonPropertyName("primary_role")]
    public string? PrimaryRole { get; set; }
}
