namespace IndentMate.Mobile.Views;

public partial class AddItemSERPage : ContentPage
{
    public AddItemSERPage()
    {
        InitializeComponent();
    }

    private async void OnBackClicked(object sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("//home");
    }
}
