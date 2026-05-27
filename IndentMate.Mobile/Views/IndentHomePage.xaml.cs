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
    }
}
