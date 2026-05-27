using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Shared.Models;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class HomeViewModel : BaseViewModel
{
    [ObservableProperty] private string _welcomeMessage = "Welcome back!";
    [ObservableProperty] private int _pendingCount;
    [ObservableProperty] private int _raisedCount;
    [ObservableProperty] private int _rejectedCount;
    [ObservableProperty] private int _createdCount;

    public ObservableCollection<IndentSummary> RecentIndents { get; } = new();

    public HomeViewModel()
    {
        LoadDashboardAsync().ConfigureAwait(false);
    }

    [RelayCommand]
    private async Task LoadDashboardAsync()
    {
        await RunBusyAsync(async () =>
        {
            // TODO: Load counts and recent indents from AppDatabase
            await Task.Delay(300); // placeholder
            PendingCount = 0;
            RaisedCount = 0;
            RejectedCount = 0;
            CreatedCount = 0;
        });
    }

    [RelayCommand]
    private async Task NewIndentAsync()
    {
        await Shell.Current.GoToAsync("indent-header");
    }
}
