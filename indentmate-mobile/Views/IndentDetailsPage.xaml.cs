namespace IndentMate.Mobile.Views;

public partial class IndentDetailsPage : ContentPage
{
    public IndentDetailsPage()
    {
        InitializeComponent();
    }

    private async void OnBackClicked(object sender, EventArgs e)
    {
        var route = BindingContext is ViewModels.IndentDetailsViewModel viewModel && viewModel.IsSerIndent
            ? "//ser-dashboard"
            : "//sie-dashboard";
        await Shell.Current.GoToAsync(route);
    }
}
