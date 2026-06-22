using IndentMate.Mobile.Services;
using IndentMate.Mobile.ViewModels;

namespace IndentMate.Mobile.Views;

public partial class IndentHomePage : ContentPage
{
    public IndentHomePage()
    {
        InitializeComponent();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        if (BindingContext is IndentHomeViewModel viewModel)
        {
            viewModel.RefreshCommand.Execute(null);
        }

        var syncService = IPlatformApplication.Current?.Services?.GetService<SyncService>();
        if (syncService != null)
            _ = syncService.PushPendingIndentsAsync();
    }

    protected override bool OnBackButtonPressed()
    {
        if (BindingContext is IndentHomeViewModel viewModel)
        {
            viewModel.BackCommand.Execute(null);
            return true;
        }

        return base.OnBackButtonPressed();
    }
}
