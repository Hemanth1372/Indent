using IndentMate.Mobile.ViewModels;

namespace IndentMate.Mobile.Views;

public partial class LoginPage : ContentPage
{
    public LoginPage()
    {
        InitializeComponent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        if (BindingContext is LoginViewModel viewModel)
        {
            await viewModel.LoadEngineerInfoAsync();
        }
    }

    private void OnPinEntryTextChanged(object? sender, TextChangedEventArgs e)
    {
        NotifyUserInteraction();
    }

    private void OnUserInteraction(object? sender, TappedEventArgs e)
    {
        NotifyUserInteraction();
    }

    private void OnPinDisplayTapped(object? sender, TappedEventArgs e)
    {
        NotifyUserInteraction();
        HiddenPinEntry.Focus();
    }

    private void NotifyUserInteraction()
    {
        if (BindingContext is LoginViewModel viewModel)
        {
            viewModel.ResetInactivityTimer();
        }
    }
}
