using IndentMate.Mobile.Views;

namespace IndentMate.Mobile;

public partial class AppShell : Shell
{
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
    }
}
