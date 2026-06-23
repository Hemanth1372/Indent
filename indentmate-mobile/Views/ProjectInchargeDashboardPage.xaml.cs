using IndentMate.Mobile.ViewModels;

namespace IndentMate.Mobile.Views;

public partial class ProjectInchargeDashboardPage : ContentPage
{
    public ProjectInchargeDashboardPage()
    {
        InitializeComponent();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        if (BindingContext is ProjectInchargeDashboardViewModel viewModel)
            _ = viewModel.LoadAsync();
    }
}
