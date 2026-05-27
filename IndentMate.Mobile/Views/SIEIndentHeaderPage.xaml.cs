using IndentMate.Mobile.ViewModels;

namespace IndentMate.Mobile.Views;

public partial class SIEIndentHeaderPage : ContentPage
{
    public SIEIndentHeaderPage()
    {
        InitializeComponent();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        if (BindingContext is SIEIndentHeaderViewModel viewModel)
        {
            viewModel.RefreshCommand.Execute(null);
        }
    }

    private async void OnBackClicked(object sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("//home");
    }
}
