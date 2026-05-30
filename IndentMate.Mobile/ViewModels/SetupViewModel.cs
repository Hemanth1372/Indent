using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;

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
        _databaseService = new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db"));
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri("http://localhost:4000"),
            Timeout = TimeSpan.FromSeconds(10)
        };
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

            var normalizedEngineerId = EngineerId.Trim();

            if (string.IsNullOrWhiteSpace(normalizedEngineerId))
                throw new InvalidOperationException("Engineer ID is required.");

            if (string.IsNullOrWhiteSpace(Pin) || Pin.Length < 6)
                throw new InvalidOperationException("PIN must be 6 digits.");

            StatusMessage = "Saving local configuration...";
            var pinHash = LNApiService.ComputeSHA256Hash(Pin);
            await SecureStorage.Default.SetAsync("ln_environment", LnEnvironment);
            await SecureStorage.Default.SetAsync("company", Company);
            await SecureStorage.Default.SetAsync("engineer_id", normalizedEngineerId);
            await SecureStorage.Default.SetAsync("engineer_name", normalizedEngineerId);
            await SecureStorage.Default.SetAsync("pin_hash", pinHash);
            await SecureStorage.Default.SetAsync("jwt_token", "local-development-token");
            Preferences.Default.Set(DeviceSetupCompleteKey, true);

            var responsibilityCode = normalizedEngineerId.StartsWith("SER", StringComparison.OrdinalIgnoreCase)
                ? "SER"
                : "SIE";

            var engineer = new LocalEngineer
            {
                EngineerId = normalizedEngineerId,
                Name = normalizedEngineerId,
                PinHash = pinHash,
                LNEnvironment = LnEnvironment,
                Company = Company,
                ResponsibilityCode = responsibilityCode,
                LastSyncAt = DateTime.UtcNow
            };
            await _databaseService.SaveAsync(engineer);
            await TrySyncPinToAdminApiAsync(normalizedEngineerId, Pin);

            StatusMessage = "Preparing local data...";
            await SeedLocalDataAsync(normalizedEngineerId);

            await Shell.Current.GoToAsync("//login");
        });
    }

    private async Task TrySyncPinToAdminApiAsync(string engineerId, string pin)
    {
        try
        {
            StatusMessage = "Syncing PIN to admin portal...";
            await _httpClient.PostAsJsonAsync("/api/users/sync-pin", new
            {
                login_name = engineerId,
                employee_name = engineerId,
                current_pin = pin
            });
        }
        catch
        {
            // Setup remains local-first if the admin API is unavailable.
        }
    }

    partial void OnSelectedLNEnvironmentOptionChanged(LNEnvironmentOption? value)
    {
        if (value is not null)
        {
            LnEnvironment = value.Code;
        }
    }

    private async Task SeedLocalDataAsync(string engineerId)
    {
        var projects = new[]
        {
            new LocalProject
            {
                ProjectId = "PRJ-SIE-001",
                Description = "Local SIE Project",
                SiteCode = "SITE-SIE",
                AddressCode = "ADDR-SIE",
                EngineerId = engineerId,
                ResponsibilityCode = "SIE"
            },
            new LocalProject
            {
                ProjectId = "PRJ-SER-001",
                Description = "Local SER Project",
                SiteCode = "SITE-SER",
                AddressCode = "ADDR-SER",
                EngineerId = engineerId,
                ResponsibilityCode = "SER"
            }
        };
        await _databaseService.SaveBatchAsync(projects);

        await _databaseService.SaveBatchAsync(new[]
        {
            new LocalWarehouse
            {
                WarehouseCode = "VWH-SIE",
                Description = "Virtual Material Warehouse",
                SiteCode = "SITE-SIE",
                IsMaterialWH = true,
                IsVirtual = true
            },
            new LocalWarehouse
            {
                WarehouseCode = "MWH-SIE",
                Description = "Material Warehouse",
                SiteCode = "SITE-SIE",
                IsMaterialWH = true,
                IsVirtual = false
            }
        });

        await _databaseService.SaveBatchAsync(new[]
        {
            new LocalWarehouseLocation { LocationCode = "STO-01", WarehouseCode = "VWH-SIE", Description = "Main Storage", Category = "Storage" },
            new LocalWarehouseLocation { LocationCode = "EMP-01", WarehouseCode = "VWH-SIE", Description = "Employee Location", Category = "Employee" },
            new LocalWarehouseLocation { LocationCode = "SUB-01", WarehouseCode = "VWH-SIE", Description = "Subcontractor Location", Category = "Subcon" },
            new LocalWarehouseLocation { LocationCode = "BIN-01", WarehouseCode = "MWH-SIE", Description = "Warehouse Bin 01", Category = "Storage" }
        });

        await _databaseService.SaveBatchAsync(new[]
        {
            new LocalBusinessPartner
            {
                BusinessPartnerId = "BP-SUB-001",
                ProjectId = "PRJ-SIE-001",
                ActivityId = "ACT-BOQ-001",
                Name = "Local Subcontractor",
                SubcontractorPO = true
            }
        });

        await _databaseService.SaveBatchAsync(new[]
        {
            new LocalLocation { LocationCode = "LOC-SIE-01", ProjectId = "PRJ-SIE-001", Description = "SIE Project Location", WarehouseCode = "MWH-SIE" },
            new LocalLocation { LocationCode = "LOC-SER-01", ProjectId = "PRJ-SER-001", Description = "SER Project Location" }
        });

        await _databaseService.SaveBatchAsync(new[]
        {
            new LocalActivity
            {
                ActivityId = "ACT-BOQ-001",
                ProjectId = "PRJ-SIE-001",
                Description = "Civil Work Package",
                ActivityType = "Work package",
                CapacityType = "Material",
                Status = "Released"
            },
            new LocalActivity
            {
                ActivityId = "ACT-NBOQ-001",
                ProjectId = "PRJ-SIE-001",
                Description = "Sundry Cost Control",
                ActivityType = "Control account",
                CapacityType = "Sundry Cost",
                Status = "Released"
            }
        });

        await _databaseService.SaveBatchAsync(new[]
        {
            new LocalItem { ItemCode = "MAT-001", Description = "Cement Bag", PurchaseUnit = "BAG", UoM = "BAG", ItemGroup = 10, SiteCode = "SITE-SIE", OnHandQty = 100 },
            new LocalItem { ItemCode = "MAT-002", Description = "Steel Rod", PurchaseUnit = "KG", UoM = "KG", ItemGroup = 10, SiteCode = "SITE-SIE", OnHandQty = 250 },
            new LocalItem { ItemCode = "SER-MAT-001", Description = "Hydraulic Hose", PurchaseUnit = "EA", UoM = "EA", ItemGroup = 20, SiteCode = "SITE-SER", OnHandQty = 15 },
            new LocalItem { ItemCode = "SER-MAT-002", Description = "Service Oil", PurchaseUnit = "LTR", UoM = "LTR", ItemGroup = 20, SiteCode = "SITE-SER", OnHandQty = 60 }
        });

        await _databaseService.SaveBatchAsync(new[]
        {
            new LocalServiceOrder
            {
                OrderNo = "SEV-00006",
                Status = "Released",
                SiteCode = "SITE-SER",
                Equipment = "Hydraulic Crane",
                SerialNumber = "TS09 1234",
                Description = "Hydraulic Crane"
            }
        });

        await _databaseService.SaveBatchAsync(new[]
        {
            new LocalRentalOrder
            {
                OrderNo = "REN-00011",
                Status = "Released",
                SiteCode = "SITE-SER",
                ProjectCode = "PRJ-SER-001",
                Equipment = "Compressor",
                SerialNumber = "CP22 9087",
                Description = "Air Compressor"
            }
        });
    }
}

public record LNEnvironmentOption(string Code, string DisplayName);
