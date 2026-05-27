using IndentMate.Mobile.ViewModels;

namespace IndentMate.Mobile.Views;

public partial class SERIndentHeaderPage : ContentPage
{
    public SERIndentHeaderPage()
    {
        InitializeComponent();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        if (BindingContext is SERIndentHeaderViewModel viewModel)
        {
            viewModel.RefreshCommand.Execute(null);
        }
    }

    private async void OnBackClicked(object sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("//home");
    }
}
