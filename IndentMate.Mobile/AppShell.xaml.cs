using IndentMate.Mobile.Views;

namespace IndentMate.Mobile;

public partial class AppShell : Shell
{
    private const string DeviceSetupCompleteKey = "indentmate_device_setup_complete";

    public AppShell()
    {
        InitializeComponent();

        // Register routes not declared in XAML (for programmatic navigation)
        Routing.RegisterRoute("setup", typeof(SetupPage));
        Routing.RegisterRoute("login", typeof(LoginPage));
        Routing.RegisterRoute("home", typeof(IndentHomePage));
        Routing.RegisterRoute("indent-home", typeof(IndentHomePage));
        Routing.RegisterRoute("indent-header", typeof(SIEIndentHeaderPage));
        Routing.RegisterRoute("sie-indent-header", typeof(SIEIndentHeaderPage));
        Routing.RegisterRoute("ser-indent-header", typeof(SERIndentHeaderPage));
        Routing.RegisterRoute("indent-details", typeof(IndentDetailsPage));
        Routing.RegisterRoute("add-item", typeof(AddItemPage));
        Routing.RegisterRoute("add-item-ser", typeof(AddItemSERPage));

        Loaded += OnLoaded;
    }

    private async void OnLoaded(object? sender, EventArgs e)
    {
        Loaded -= OnLoaded;

        var isDeviceSetup = Preferences.Default.Get(DeviceSetupCompleteKey, false);
        await GoToAsync(isDeviceSetup ? "//login" : "//setup");
    }
}
