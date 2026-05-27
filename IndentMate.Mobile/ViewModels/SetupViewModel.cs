using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Security.Cryptography;
using System.Text;

namespace IndentMate.Mobile.ViewModels;

/// <summary>
/// ViewModel for initial setup screen.
/// Handles LN authentication, configuration storage, and initial sync.
/// </summary>
public partial class SetupViewModel : BaseViewModel
{
    private readonly LNApiService _lnApiService;
    private readonly SyncService _syncService;
    private readonly DatabaseService _databaseService;

    [ObservableProperty] private string _lnEnvironment = "TST";
    [ObservableProperty] private string _company = string.Empty;
    [ObservableProperty] private string _engineerId = string.Empty;
    [ObservableProperty] private string _pin = string.Empty;
    [ObservableProperty] private string _errorMessage = string.Empty;
    [ObservableProperty] private LNEnvironmentOption? _selectedLNEnvironmentOption;

    public List<LNEnvironmentOption> LNEnvironmentOptions { get; } = new()
    {
        new("PRD", "PRD – Production"),
        new("TRN", "TRN – Training"),
        new("TST", "TST – Test")
    };

    public SetupViewModel()
    {
        _lnApiService = new LNApiService();
        _databaseService = new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db"));
        _syncService = new SyncService(_databaseService, _lnApiService);
        SelectedLNEnvironmentOption = LNEnvironmentOptions.First(option => option.Code == LnEnvironment);
    }

    [RelayCommand]
    private async Task SaveAndSyncAsync()
    {
        await RunBusyAsync(async () =>
        {
            ErrorMessage = string.Empty;

            // Validate inputs
            if (string.IsNullOrWhiteSpace(LnEnvironment))
                throw new InvalidOperationException("LN Environment is required (PRD, TRN, TST).");

            if (string.IsNullOrWhiteSpace(Company))
                throw new InvalidOperationException("Company code is required (e.g., 100).");

            if (string.IsNullOrWhiteSpace(EngineerId))
                throw new InvalidOperationException("Engineer ID is required.");

            if (string.IsNullOrWhiteSpace(Pin) || Pin.Length < 6)
                throw new InvalidOperationException("PIN must be 6 digits.");

            // Step 1: Authenticate with LN OData
            StatusMessage = "Authenticating with LN...";
            var token = await _lnApiService.AuthenticateAsync(
                EngineerId, Pin, LnEnvironment, Company);

            if (token == null)
            {
                ErrorMessage = "Authentication failed. Check credentials and try again.";
                throw new InvalidOperationException(ErrorMessage);
            }

            // Step 2: Store configuration in SecureStorage
            StatusMessage = "Saving configuration...";
            var pinHash = LNApiService.ComputeSHA256Hash(Pin);
            await SecureStorage.Default.SetAsync("ln_environment", LnEnvironment);
            await SecureStorage.Default.SetAsync("company", Company);
            await SecureStorage.Default.SetAsync("engineer_id", EngineerId);
            await SecureStorage.Default.SetAsync("pin_hash", pinHash);
            await SecureStorage.Default.SetAsync("jwt_token", token);

            // Step 3: Store engineer in local database
            var engineer = new LocalEngineer
            {
                EngineerId = EngineerId,
                Name = EngineerId, // Will be updated on first sync
                PinHash = pinHash,
                LNEnvironment = LnEnvironment,
                Company = Company,
                ResponsibilityCode = "SIE", // Default, will be updated on sync
                LastSyncAt = null
            };
            await _databaseService.SaveAsync(engineer);

            // Step 4: Perform initial data sync from LN
            StatusMessage = "Syncing data from LN...";
            await _syncService.FullSyncAsync(EngineerId);

            // Step 5: Navigate to Login screen
            await Shell.Current.GoToAsync("//login");
        });
    }

    partial void OnSelectedLNEnvironmentOptionChanged(LNEnvironmentOption? value)
    {
        if (value is not null)
        {
            LnEnvironment = value.Code;
        }
    }
}

public record LNEnvironmentOption(string Code, string DisplayName);
