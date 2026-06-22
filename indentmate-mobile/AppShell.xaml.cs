using IndentMate.Mobile.Views;

namespace IndentMate.Mobile;

public partial class AppShell : Shell
{
    private const string DeviceSetupCompleteKey = "indentmate_device_setup_complete";
    private static readonly TimeSpan SessionDuration = TimeSpan.FromMinutes(10);
    private IDispatcherTimer? _sessionTimer;

    public AppShell()
    {
        InitializeComponent();

        // Register routes not declared in XAML (for programmatic navigation)
        Routing.RegisterRoute("setup", typeof(SetupPage));
        Routing.RegisterRoute("login", typeof(LoginPage));
        Routing.RegisterRoute("login-success", typeof(LoginSuccessPage));
        Routing.RegisterRoute("home", typeof(IndentHomePage));
        Routing.RegisterRoute("indent-home", typeof(IndentHomePage));
        Routing.RegisterRoute("sie-dashboard", typeof(IndentHomePage));
        Routing.RegisterRoute("ser-dashboard", typeof(IndentHomePage));
        Routing.RegisterRoute("sre-dashboard", typeof(IndentHomePage));
        Routing.RegisterRoute("indent-header", typeof(SIEIndentHeaderPage));
        Routing.RegisterRoute("sie-indent-header", typeof(SIEIndentHeaderPage));
        Routing.RegisterRoute("ser-indent-header", typeof(SERIndentHeaderPage));
        Routing.RegisterRoute("indent-details", typeof(IndentDetailsPage));
        Routing.RegisterRoute("add-item", typeof(AddItemPage));
        Routing.RegisterRoute("add-item-ser", typeof(AddItemSERPage));

        Loaded += OnLoaded;
        Navigating += OnShellNavigating;
    }

    private async void OnLoaded(object? sender, EventArgs e)
    {
        Loaded -= OnLoaded;

        var isDeviceSetup = Preferences.Default.Get(DeviceSetupCompleteKey, false);
        await GoToAsync(isDeviceSetup ? "//login" : "//setup");
        StartSessionTimer();
    }

    private void StartSessionTimer()
    {
        _sessionTimer = Dispatcher.CreateTimer();
        _sessionTimer.Interval = TimeSpan.FromSeconds(15);
        _sessionTimer.Tick += async (_, _) => await ExpireSessionIfNeededAsync();
        _sessionTimer.Start();
    }

    private async void OnShellNavigating(object? sender, ShellNavigatingEventArgs e)
    {
        if (IsPublicRoute(e.Target.Location.OriginalString))
        {
            return;
        }

        if (await IsSessionExpiredAsync())
        {
            e.Cancel();
            await ExpireSessionAsync();
        }
    }

    private async Task ExpireSessionIfNeededAsync()
    {
        if (await IsSessionExpiredAsync())
        {
            await ExpireSessionAsync();
        }
    }

    private static async Task<bool> IsSessionExpiredAsync()
    {
        var isActive = await SecureStorage.Default.GetAsync("session_active");
        if (!string.Equals(isActive, "true", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var expiresAtText = await SecureStorage.Default.GetAsync("session_expires_at_utc");
        if (!DateTime.TryParse(expiresAtText, null, System.Globalization.DateTimeStyles.RoundtripKind, out var expiresAtUtc))
        {
            await SecureStorage.Default.SetAsync("session_expires_at_utc", DateTime.UtcNow.Add(SessionDuration).ToString("O"));
            return false;
        }

        return DateTime.UtcNow >= expiresAtUtc.ToUniversalTime();
    }

    private static async Task ExpireSessionAsync()
    {
        SecureStorage.Default.Remove("session_active");
        SecureStorage.Default.Remove("session_expires_at_utc");
        await Current.GoToAsync("//login");
    }

    private static bool IsPublicRoute(string target)
    {
        return target.Contains("login", StringComparison.OrdinalIgnoreCase) ||
               target.Contains("setup", StringComparison.OrdinalIgnoreCase);
    }
}
