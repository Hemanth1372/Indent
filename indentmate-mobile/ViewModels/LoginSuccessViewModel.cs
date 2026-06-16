using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;

namespace IndentMate.Mobile.ViewModels;

public partial class LoginSuccessViewModel : BaseViewModel
{
    private readonly DatabaseService _databaseService;

    [ObservableProperty] private string _engineerName = "Engineer";
    [ObservableProperty] private string _engineerId = string.Empty;
    [ObservableProperty] private string _environment = string.Empty;
    [ObservableProperty] private string _role = string.Empty;
    [ObservableProperty] private string _roleDisplay = "Field Engineer";
    [ObservableProperty] private int _pendingIndentCount;

    public LoginSuccessViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")))
    {
    }

    public LoginSuccessViewModel(DatabaseService databaseService)
    {
        _databaseService = databaseService;
    }

    public string WelcomeText => $"Welcome, {EngineerName}";

    [RelayCommand]
    private async Task LoadAsync()
    {
        await RunBusyAsync(async () =>
        {
            EngineerId = await SecureStorage.Default.GetAsync("engineer_id") ?? string.Empty;
            EngineerName = await SecureStorage.Default.GetAsync("engineer_name") ?? EngineerId;
            Environment = await SecureStorage.Default.GetAsync("ln_environment") ?? string.Empty;
            Role = NormalizeRole(await SecureStorage.Default.GetAsync("user_role"));
            RoleDisplay = BuildRoleDisplay(Role);

            var indents = string.IsNullOrWhiteSpace(EngineerId)
                ? new List<LocalIndent>()
                : await _databaseService.GetIndentsForEngineerAsync(EngineerId);

            PendingIndentCount = indents.Count(IsPendingStatus);
            OnPropertyChanged(nameof(WelcomeText));
        });
    }

    [RelayCommand]
    private async Task GoHomeAsync()
    {
        var route = ResolveDashboardRoute(Role);
        if (route is null)
        {
            await HandleInvalidRoleAsync();
            return;
        }

        await Shell.Current.GoToAsync(route);
    }

    [RelayCommand]
    private async Task CreateIndentAsync()
    {
        var route = ResolveDashboardRoute(Role);

        if (route is null)
        {
            await HandleInvalidRoleAsync();
            return;
        }

        await Shell.Current.GoToAsync(route);
    }

    [RelayCommand]
    private async Task OpenPendingIndentsAsync()
    {
        var route = ResolveDashboardRoute(Role);

        if (route is null)
        {
            await HandleInvalidRoleAsync();
            return;
        }

        await Shell.Current.GoToAsync($"{route}?filter=Pending");
    }

    [RelayCommand]
    private async Task LogoutAsync()
    {
        SecureStorage.Default.Remove("session_active");
        await Shell.Current.GoToAsync("//login");
    }

    private static string NormalizeRole(string? role)
    {
        var normalizedRole = (role ?? string.Empty).Trim().ToUpperInvariant();

        return normalizedRole switch
        {
            "SRE" => "SER",
            _ when normalizedRole.Contains("(SER)") || normalizedRole.Contains("(SRE)") => "SER",
            _ when normalizedRole.Contains("SERVICE ENGINEER") || normalizedRole.Contains("SITE RECEIVING") => "SER",
            _ when normalizedRole.Contains("(SIE)") || normalizedRole.Contains("SITE ENGINEER") => "SIE",
            _ => normalizedRole
        };
    }

    private static string BuildRoleDisplay(string role)
    {
        return role switch
        {
            "SIE" => "Site Engineer (SIE)",
            "SER" => "Service Engineer (SER)",
            _ => string.IsNullOrWhiteSpace(role) ? "Field Engineer" : role
        };
    }

    private static string? ResolveDashboardRoute(string? role)
    {
        return NormalizeRole(role) switch
        {
            "SIE" => "//sie-dashboard",
            "SER" => "//ser-dashboard",
            _ => null
        };
    }

    private static async Task HandleInvalidRoleAsync()
    {
        SecureStorage.Default.Remove("session_active");
        await Shell.Current.DisplayAlertAsync(
            "Role required",
            "Access Denied: No valid SIE/SER role assigned to this user. Please login again.",
            "OK");
        await Shell.Current.GoToAsync("//login");
    }

    private static bool IsPendingStatus(LocalIndent indent)
    {
        return indent.Status is "Pending" or "PendingApproval" or "PendingSync" or "ApprovalPending" or "SyncError";
    }
}
