using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class HomeViewModel : BaseViewModel
{
    [ObservableProperty] private string _welcomeMessage = "Welcome back!";
    [ObservableProperty] private int _pendingCount;
    [ObservableProperty] private int _raisedCount;
    [ObservableProperty] private int _rejectedCount;
    [ObservableProperty] private int _createdCount;

    public ObservableCollection<IndentSummary> RecentIndents { get; } = new();

    public HomeViewModel()
    {
        LoadDashboardAsync().ConfigureAwait(false);
    }

    [RelayCommand]
    private async Task LoadDashboardAsync()
    {
        await RunBusyAsync(async () =>
        {
            // TODO: Load counts and recent indents from AppDatabase
            await Task.Delay(300); // placeholder
            PendingCount = 0;
            RaisedCount = 0;
            RejectedCount = 0;
            CreatedCount = 0;
        });
    }

    [RelayCommand]
    private async Task NewIndentAsync()
    {
        var role = NormalizeRole(await SecureStorage.Default.GetAsync("user_role"));
        var route = ResolveIndentHeaderRoute(role);

        if (route is null)
        {
            await RedirectToLoginForInvalidRoleAsync();
            return;
        }

        await Shell.Current.GoToAsync(route);
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

    private static string? ResolveIndentHeaderRoute(string? role)
    {
        return NormalizeRole(role) switch
        {
            "SIE" => "//sie-indent-header",
            "SER" => "//ser-indent-header",
            _ => null
        };
    }

    private static async Task RedirectToLoginForInvalidRoleAsync()
    {
        SecureStorage.Default.Remove("session_active");
        await Shell.Current.DisplayAlert(
            "Role required",
            "Access Denied: No valid SIE/SER role assigned to this user. Please login again.",
            "OK");
        await Shell.Current.GoToAsync("//login");
    }
}
