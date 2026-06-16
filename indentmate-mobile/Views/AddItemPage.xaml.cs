using IndentMate.Mobile.Controls;
using IndentMate.Mobile.ViewModels;

namespace IndentMate.Mobile.Views;

public partial class AddItemPage : ContentPage
{
    public AddItemPage()
    {
        InitializeComponent();
    }

    private async void OnBackClicked(object sender, EventArgs e)
    {
        DropdownField.CloseAll();
        if (BindingContext is AddItemViewModel vm && !string.IsNullOrWhiteSpace(vm.IndentId))
            await Shell.Current.GoToAsync($"//indent-details?indentId={Uri.EscapeDataString(vm.IndentId)}");
        else
            await Shell.Current.GoToAsync(await ResolveDashboardRouteAsync());
    }

    private void OnFormTapped(object? sender, TappedEventArgs e)
    {
        DropdownField.CloseAllFromOutsideTap();
    }

    private static async Task<string> ResolveDashboardRouteAsync()
    {
        var role = (await SecureStorage.Default.GetAsync("user_role") ?? string.Empty).Trim().ToUpperInvariant();
        return role == "SER" ? "//ser-dashboard" : "//sie-dashboard";
    }
}
