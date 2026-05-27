using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class IndentHomeViewModel : BaseViewModel
{
    private readonly DatabaseService _databaseService;

    [ObservableProperty] private int _pendingApprovalCount;
    [ObservableProperty] private int _indentsRaisedCount;
    [ObservableProperty] private int _rejectedIndentsCount;
    [ObservableProperty] private int _createdStatusCount;

    public ObservableCollection<RecentIndentViewModel> RecentIndents { get; } = new();

    public IndentHomeViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")))
    {
    }

    public IndentHomeViewModel(DatabaseService databaseService)
    {
        _databaseService = databaseService;
    }

    [RelayCommand]
    private async Task RefreshAsync()
    {
        await RunBusyAsync(async () =>
        {
            var engineerId = await SecureStorage.Default.GetAsync("engineer_id") ?? string.Empty;
            if (string.IsNullOrWhiteSpace(engineerId))
            {
                PendingApprovalCount = 0;
                IndentsRaisedCount = 0;
                RejectedIndentsCount = 0;
                CreatedStatusCount = 0;
                RecentIndents.Clear();
                return;
            }

            var indents = await _databaseService.GetIndentsForEngineerAsync(engineerId);

            PendingApprovalCount = indents.Count(i => i.Status == "PendingApproval");
            IndentsRaisedCount = indents.Count;
            RejectedIndentsCount = indents.Count(i => i.Status == "Rejected");
            CreatedStatusCount = indents.Count(i => i.Status == "Created");

            RecentIndents.Clear();
            foreach (var indent in indents.Take(10))
            {
                RecentIndents.Add(new RecentIndentViewModel(indent));
            }
        });
    }

    [RelayCommand]
    private async Task OpenIndentAsync(RecentIndentViewModel? indent)
    {
        if (indent is null) return;

        await Shell.Current.GoToAsync($"//indent-details?indentId={Uri.EscapeDataString(indent.IndentId)}");
    }

    [RelayCommand]
    private async Task NewIndentAsync()
    {
        var engineerId = await SecureStorage.Default.GetAsync("engineer_id") ?? string.Empty;
        var engineer = string.IsNullOrWhiteSpace(engineerId)
            ? null
            : await _databaseService.GetEngineerAsync(engineerId);

        var route = string.Equals(engineer?.ResponsibilityCode, "SER", StringComparison.OrdinalIgnoreCase)
            ? "//ser-indent-header"
            : "//indent-header";

        await Shell.Current.GoToAsync(route);
    }

    [RelayCommand]
    private async Task LogoutAsync()
    {
        SecureStorage.Default.Remove("session_active");
        await Shell.Current.GoToAsync("//login");
    }
}

public class RecentIndentViewModel
{
    public RecentIndentViewModel(LocalIndent indent)
    {
        IndentId = indent.IndentId;
        RequestNo = string.IsNullOrWhiteSpace(indent.RequestNo) ? indent.IndentId : indent.RequestNo;
        CreatedAt = indent.CreatedAt;
        DateText = indent.CreatedAt.ToString("dd MMM yyyy");
        Status = indent.Status;
        StatusColor = indent.Status switch
        {
            "PendingApproval" => Color.FromArgb("#1565D8"),
            "Approved" => Color.FromArgb("#16A34A"),
            "Rejected" => Color.FromArgb("#D92D20"),
            _ => Color.FromArgb("#6B7280")
        };
    }

    public string IndentId { get; }
    public string RequestNo { get; }
    public DateTime CreatedAt { get; }
    public string DateText { get; }
    public string Status { get; }
    public Color StatusColor { get; }
}
