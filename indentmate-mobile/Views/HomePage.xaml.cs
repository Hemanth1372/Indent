using IndentMate.Mobile.ViewModels;

namespace IndentMate.Mobile.Views;

public partial class HomePage : ContentPage
{
    public HomePage()
    {
        InitializeComponent();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        if (BindingContext is HomeViewModel viewModel)
        {
            viewModel.LoadDashboardCommand.Execute(null);
        }
    }
}
