using IndentMate.Mobile.ViewModels;

namespace IndentMate.Mobile.Views;

public partial class LoginSuccessPage : ContentPage
{
    public LoginSuccessPage()
    {
        InitializeComponent();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        if (BindingContext is LoginSuccessViewModel viewModel)
        {
            viewModel.LoadCommand.Execute(null);
        }
    }
}
