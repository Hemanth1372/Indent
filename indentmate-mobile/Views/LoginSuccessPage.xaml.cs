using IndentMate.Mobile.ViewModels;

namespace IndentMate.Mobile.Views;

public partial class LoginSuccessPage : ContentPage
{
    private CancellationTokenSource? _redirectCancellationTokenSource;

    public LoginSuccessPage()
    {
        InitializeComponent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        _redirectCancellationTokenSource?.Cancel();
        _redirectCancellationTokenSource = new CancellationTokenSource();
        var token = _redirectCancellationTokenSource.Token;

        if (BindingContext is LoginSuccessViewModel viewModel)
        {
            await viewModel.LoadCommand.ExecuteAsync(null);

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(2), token);
            }
            catch (TaskCanceledException)
            {
                return;
            }

            if (!token.IsCancellationRequested)
            {
                await viewModel.GoHomeCommand.ExecuteAsync(null);
            }
        }
    }

    protected override void OnDisappearing()
    {
        _redirectCancellationTokenSource?.Cancel();
        base.OnDisappearing();
    }
}
