using IndentMate.Mobile.Controls;
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

    protected override void OnDisappearing()
    {
        DropdownField.CloseAll();
        base.OnDisappearing();
    }

    private async void OnBackClicked(object? sender, EventArgs e)
    {
        await NavigateBackAsync();
    }

    protected override bool OnBackButtonPressed()
    {
        _ = NavigateBackAsync();
        return true;
    }

    private async Task NavigateBackAsync()
    {
        DropdownField.CloseAll();
        await Shell.Current.GoToAsync("//ser-dashboard");
    }

    private void OnFormTapped(object? sender, TappedEventArgs e)
    {
        DropdownField.CloseAllFromOutsideTap();
    }

}
