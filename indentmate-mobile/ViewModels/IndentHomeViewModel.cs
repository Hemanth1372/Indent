using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class IndentHomeViewModel : BaseViewModel, IQueryAttributable
{
    private readonly DatabaseService _databaseService;
    private readonly ApiService _apiService;
    private List<LocalIndent> _allIndents = new();
    private List<LocalIndent> _visibleIndents = new();

    [ObservableProperty] private string _dashboardTitle = "Indent Home";
    [ObservableProperty] private string _userInfo = string.Empty;
    [ObservableProperty] private string _userInitials = "IM";
    [ObservableProperty] private string _userName = string.Empty;
    [ObservableProperty] private string _userId = string.Empty;
    [ObservableProperty] private string _userEntity = string.Empty;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(PendingCardBg))]
    [NotifyPropertyChangedFor(nameof(PendingAccentColor))]
    [NotifyPropertyChangedFor(nameof(PendingNumColor))]
    private int _pendingApprovalCount;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(RaisedCardBg))]
    [NotifyPropertyChangedFor(nameof(RaisedAccentColor))]
    [NotifyPropertyChangedFor(nameof(RaisedNumColor))]
    private int _indentsRaisedCount;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(RejectedCardBg))]
    [NotifyPropertyChangedFor(nameof(RejectedAccentColor))]
    [NotifyPropertyChangedFor(nameof(RejectedNumColor))]
    private int _rejectedIndentsCount;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(PendingSyncCardBg))]
    [NotifyPropertyChangedFor(nameof(PendingSyncAccentColor))]
    [NotifyPropertyChangedFor(nameof(PendingSyncNumColor))]
    private int _pendingSyncCount;

    [ObservableProperty] private string _selectedStatusFilter = "All";
    [ObservableProperty] private bool _showAllRequests;
    [ObservableProperty] private bool _showNotifications;
    [ObservableProperty] private bool _showAccountMenu;
    [ObservableProperty] private int _unreadNotificationCount;
    [ObservableProperty] private ProjectFilterOption? _selectedProjectFilter;

    // ── Pending for Approval (amber) ─────────────────────────────────────────
    public Color PendingCardBg => PendingApprovalCount > 0 ? Color.FromArgb("#FFFBEB") : Colors.White;
    public Color PendingAccentColor => PendingApprovalCount > 0 ? Color.FromArgb("#F7931E") : Color.FromArgb("#E5EAF2");
    public Color PendingNumColor => PendingApprovalCount > 0 ? Color.FromArgb("#D97706") : Color.FromArgb("#CBD5E1");

    // ── Indents Raised (blue) ────────────────────────────────────────────────
    public Color RaisedCardBg => IndentsRaisedCount > 0 ? Color.FromArgb("#F4F6FB") : Colors.White;
    public Color RaisedAccentColor => IndentsRaisedCount > 0 ? Color.FromArgb("#1D2B58") : Color.FromArgb("#E5EAF2");
    public Color RaisedNumColor => IndentsRaisedCount > 0 ? Color.FromArgb("#1D2B58") : Color.FromArgb("#CBD5E1");

    // ── Rejected Indents (red) ───────────────────────────────────────────────
    public Color RejectedCardBg => RejectedIndentsCount > 0 ? Color.FromArgb("#FEF2F2") : Colors.White;
    public Color RejectedAccentColor => RejectedIndentsCount > 0 ? Color.FromArgb("#DC2626") : Color.FromArgb("#E5EAF2");
    public Color RejectedNumColor => RejectedIndentsCount > 0 ? Color.FromArgb("#DC2626") : Color.FromArgb("#CBD5E1");

    // ── Pending Sync (orange) ───────────────────────────────────────────────
    public Color PendingSyncCardBg => PendingSyncCount > 0 ? Color.FromArgb("#FFEDD5") : Colors.White;
    public Color PendingSyncAccentColor => PendingSyncCount > 0 ? Color.FromArgb("#EA580C") : Color.FromArgb("#E5EAF2");
    public Color PendingSyncNumColor => PendingSyncCount > 0 ? Color.FromArgb("#C2410C") : Color.FromArgb("#CBD5E1");

    public ObservableCollection<StatusFilterViewModel> StatusFilters { get; } = new();
    public ObservableCollection<ProjectFilterOption> ProjectFilters { get; } = new();
    public ObservableCollection<RecentIndentViewModel> RecentIndents { get; } = new();
    public ObservableCollection<AppNotificationViewModel> Notifications { get; } = new();
    public bool HasSeeAllAction => ShowAllRequests || GetFilteredIndents().Count > 10;
    public string SeeAllText => ShowAllRequests ? "Show Recent" : "See All";
    public bool HasUnreadNotifications => UnreadNotificationCount > 0;
    public bool HasNotifications => Notifications.Count > 0;
    public bool HasNoNotifications => Notifications.Count == 0;

    public IndentHomeViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")), new ApiService())
    {
    }

    public IndentHomeViewModel(DatabaseService databaseService, ApiService apiService)
    {
        _databaseService = databaseService;
        _apiService = apiService;
        Notifications.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasNotifications));
            OnPropertyChanged(nameof(HasNoNotifications));
        };
        BuildStatusFilters();
    }

    partial void OnUnreadNotificationCountChanged(int value)
    {
        OnPropertyChanged(nameof(HasUnreadNotifications));
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (!query.TryGetValue("filter", out var filterValue))
        {
            return;
        }

        var filter = NormalizeStatusFilter(filterValue?.ToString());
        if (string.IsNullOrWhiteSpace(filter))
        {
            return;
        }

        SelectedStatusFilter = filter;
        ShowAllRequests = false;
        UpdateStatusFilterSelection();
        ApplyFilter();
    }

    [RelayCommand]
    private async Task RefreshAsync()
    {
        await RunBusyAsync(async () =>
        {
            var engineerId = await SecureStorage.Default.GetAsync("engineer_id") ?? string.Empty;
            var engineerName = await SecureStorage.Default.GetAsync("engineer_name") ?? string.Empty;
            var environment = await SecureStorage.Default.GetAsync("ln_environment") ?? string.Empty;
            var company = await SecureStorage.Default.GetAsync("company") ?? string.Empty;

            DashboardTitle = "Indent Home";
            UserInfo = BuildUserInfo(engineerId, engineerName, environment, company);
            UserInitials = BuildInitials(engineerName.Length > 0 ? engineerName : engineerId);
            UserName = string.IsNullOrWhiteSpace(engineerName) ? engineerId : engineerName;
            UserId = engineerId;
            UserEntity = BuildEntity(environment, company);

            if (string.IsNullOrWhiteSpace(engineerId))
            {
                PendingApprovalCount = 0;
                IndentsRaisedCount = 0;
                RejectedIndentsCount = 0;
                PendingSyncCount = 0;
                UnreadNotificationCount = 0;
                _allIndents = new List<LocalIndent>();
                _visibleIndents = new List<LocalIndent>();
                ProjectFilters.Clear();
                RecentIndents.Clear();
                Notifications.Clear();
                OnPropertyChanged(nameof(HasSeeAllAction));
                OnPropertyChanged(nameof(HasNotifications));
                OnPropertyChanged(nameof(HasNoNotifications));
                return;
            }

            await ReconcileSyncedIndentsWithServerAsync();
            await LoadNotificationsAsync();
            _allIndents = (await _databaseService.GetIndentsForEngineerAsync(engineerId))
                .Where(indent => indent.Status != "Incomplete")
                .ToList();

            BuildProjectFilters();
            ApplyProjectFilter();
            ApplyFilter();
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

        var role = NormalizeRole(engineer?.ResponsibilityCode ?? await SecureStorage.Default.GetAsync("user_role"));
        var route = ResolveIndentHeaderRoute(role);

        if (route is null)
        {
            await RedirectToLoginForInvalidRoleAsync();
            return;
        }

        await Shell.Current.GoToAsync(route);
    }

    [RelayCommand]
    private async Task BackAsync()
    {
        await Shell.Current.GoToAsync("//login-success");
    }

    [RelayCommand]
    private async Task ToggleNotificationsAsync()
    {
        ShowNotifications = !ShowNotifications;
        if (ShowNotifications)
        {
            await LoadNotificationsAsync();
        }
    }

    [RelayCommand]
    private void CloseNotifications()
    {
        ShowNotifications = false;
    }

    [RelayCommand]
    private void ToggleAccountMenu()
    {
        ShowAccountMenu = !ShowAccountMenu;
    }

    [RelayCommand]
    private void CloseAccountMenu()
    {
        ShowAccountMenu = false;
    }

    [RelayCommand]
    private async Task OpenNotificationAsync(AppNotificationViewModel? notification)
    {
        if (notification is null)
            return;

        var wasUnread = !notification.IsRead;
        await _apiService.MarkNotificationReadAsync(notification.Id);
        notification.IsRead = true;
        if (wasUnread)
        {
            UnreadNotificationCount = Math.Max(0, UnreadNotificationCount - 1);
        }

        var engineerId = await SecureStorage.Default.GetAsync("engineer_id") ?? string.Empty;
        var indent = await _databaseService.GetIndentByOfficialNoAsync(engineerId, notification.IndentNo);
        if (indent is not null)
        {
            ShowNotifications = false;
            await Shell.Current.GoToAsync($"//indent-details?indentId={Uri.EscapeDataString(indent.IndentId)}");
        }
    }

    [RelayCommand]
    private async Task MarkAllNotificationsReadAsync()
    {
        if (Notifications.Count == 0)
            return;

        await _apiService.MarkAllNotificationsReadAsync();
        foreach (var notification in Notifications)
        {
            notification.IsRead = true;
        }

        UnreadNotificationCount = 0;
    }

    [RelayCommand]
    private void SelectStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return;
        }

        SelectedStatusFilter = status;
        ShowAllRequests = false;
        UpdateStatusFilterSelection();
        ApplyFilter();
    }

    [RelayCommand]
    private void SelectSummaryCard(string? status)
    {
        SelectStatusFilter(status);
    }

    [RelayCommand]
    private void ToggleSeeAll()
    {
        ShowAllRequests = !ShowAllRequests;
        ApplyFilter();
    }

    partial void OnSelectedProjectFilterChanged(ProjectFilterOption? value)
    {
        ShowAllRequests = false;
        ApplyProjectFilter();
        ApplyFilter();
    }

    private void BuildStatusFilters()
    {
        StatusFilters.Clear();
        foreach (var status in new[] { "All", "Pending", "Pending Sync", "Approved", "Rejected" })
        {
            StatusFilters.Add(new StatusFilterViewModel(status, status == SelectedStatusFilter));
        }
    }

    private void UpdateStatusFilterSelection()
    {
        foreach (var filter in StatusFilters)
        {
            filter.IsSelected = string.Equals(filter.Label, SelectedStatusFilter, StringComparison.OrdinalIgnoreCase);
        }
    }

    private void ApplyFilter()
    {
        var filteredIndents = GetFilteredIndents();
        var visibleIndents = ShowAllRequests
            ? filteredIndents
            : filteredIndents.Take(10).ToList();

        RecentIndents.Clear();
        foreach (var indent in visibleIndents)
        {
            RecentIndents.Add(new RecentIndentViewModel(indent));
        }

        OnPropertyChanged(nameof(HasSeeAllAction));
        OnPropertyChanged(nameof(SeeAllText));
    }

    private void BuildProjectFilters()
    {
        var selectedProjectId = SelectedProjectFilter?.ProjectId ?? string.Empty;
        ProjectFilters.Clear();
        ProjectFilters.Add(new ProjectFilterOption("All Projects", string.Empty));

        foreach (var project in _allIndents
            .Where(indent => !string.IsNullOrWhiteSpace(indent.ProjectId))
            .GroupBy(indent => indent.ProjectId, StringComparer.OrdinalIgnoreCase)
            .Select(group => new ProjectFilterOption(BuildProjectLabel(group.First()), group.Key))
            .OrderBy(project => project.Label))
        {
            ProjectFilters.Add(project);
        }

        SelectedProjectFilter = ProjectFilters.FirstOrDefault(project =>
            string.Equals(project.ProjectId, selectedProjectId, StringComparison.OrdinalIgnoreCase))
            ?? ProjectFilters.FirstOrDefault();
    }

    private void ApplyProjectFilter()
    {
        var selectedProjectId = SelectedProjectFilter?.ProjectId ?? string.Empty;
        _visibleIndents = string.IsNullOrWhiteSpace(selectedProjectId)
            ? _allIndents.ToList()
            : _allIndents
                .Where(indent => string.Equals(indent.ProjectId, selectedProjectId, StringComparison.OrdinalIgnoreCase))
                .ToList();

        PendingApprovalCount = _visibleIndents.Count(IsPendingStatus);
        IndentsRaisedCount = _visibleIndents.Count;
        RejectedIndentsCount = _visibleIndents.Count(i => i.Status == "Rejected");
        PendingSyncCount = _visibleIndents.Count(IsPendingSyncStatus);
        OnPropertyChanged(nameof(HasSeeAllAction));
    }

    private async Task ReconcileSyncedIndentsWithServerAsync()
    {
        try
        {
            var serverIndents = await _apiService.GetMyIndentReferencesAsync();
            var serverRequestNumbers = serverIndents
                .Select(indent => NormalizeLookupKey(indent.AppRequestId))
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var serverIndentNumbers = serverIndents
                .Select(indent => NormalizeLookupKey(indent.IndentNo))
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            await _databaseService.RemoveSyncedIndentsMissingFromServerAsync(
                UserId,
                serverRequestNumbers,
                serverIndentNumbers);
            await _databaseService.UpdateSyncedIndentServerStateAsync(UserId, serverIndents);
        }
        catch
        {
            // Keep the offline cache if the server cannot be reached.
        }
    }

    private async Task LoadNotificationsAsync()
    {
        try
        {
            var result = await _apiService.GetNotificationsAsync();
            Notifications.Clear();
            foreach (var notification in result.Notifications.Take(8))
            {
                Notifications.Add(new AppNotificationViewModel(notification));
            }

            UnreadNotificationCount = result.UnreadCount;
            OnPropertyChanged(nameof(HasUnreadNotifications));
            OnPropertyChanged(nameof(HasNotifications));
            OnPropertyChanged(nameof(HasNoNotifications));
        }
        catch
        {
            // Notifications should not block the dashboard.
        }
    }

    private List<LocalIndent> GetFilteredIndents()
    {
        return SelectedStatusFilter switch
        {
            "Pending" => _visibleIndents.Where(IsPendingStatus).ToList(),
            "Pending Sync" => _visibleIndents.Where(IsPendingSyncStatus).ToList(),
            "Approved" => _visibleIndents.Where(indent => indent.Status == "Approved").ToList(),
            "Rejected" => _visibleIndents.Where(indent => indent.Status == "Rejected").ToList(),
            _ => _visibleIndents.ToList()
        };
    }

    private static string NormalizeRole(string? role)
    {
        var normalizedRole = (role ?? string.Empty).Trim().ToUpperInvariant();

        return normalizedRole switch
        {
            "SRE" => "SER",
            _ when normalizedRole.Contains("(SER)") || normalizedRole.Contains("(SRE)") => "SER",
            _ when normalizedRole.Contains("SERVICE ENGINEER") || normalizedRole.Contains("SITE RECEIVING") => "SER",
            _ when normalizedRole.Contains("(SIE)") || normalizedRole.Contains("SITE ENGINEER") => "SIE",
            _ => normalizedRole
        };
    }

    private static string? ResolveIndentHeaderRoute(string? role)
    {
        return NormalizeRole(role) switch
        {
            "SIE" => "//sie-indent-header",
            "SER" => "//ser-indent-header",
            _ => null
        };
    }

    private static async Task RedirectToLoginForInvalidRoleAsync()
    {
        SecureStorage.Default.Remove("session_active");
        await Shell.Current.DisplayAlert(
            "Role required",
            "Access Denied: No valid SIE/SER role assigned to this user. Please login again.",
            "OK");
        await Shell.Current.GoToAsync("//login");
    }

    private static bool IsPendingStatus(LocalIndent indent)
    {
        return indent.Status is "Pending" or "PendingApproval" or "ApprovalPending";
    }

    private static bool IsPendingSyncStatus(LocalIndent indent)
    {
        return indent.Status is "PendingSync" or "SyncError";
    }

    private static string NormalizeStatusFilter(string? status)
    {
        return (status ?? string.Empty).Trim() switch
        {
            "Pending" => "Pending",
            "Pending Sync" => "Pending Sync",
            "Approved" => "Approved",
            "Rejected" => "Rejected",
            "All" => "All",
            _ => string.Empty
        };
    }

    private static string NormalizeLookupKey(string? value)
    {
        return (value ?? string.Empty).Trim().ToUpperInvariant();
    }

    private static string BuildInitials(string name)
    {
        var parts = (name ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "?";
        if (parts.Length == 1) return parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant();
        return $"{parts[0][0]}{parts[^1][0]}".ToUpperInvariant();
    }

    private static string BuildUserInfo(string engineerId, string engineerName, string environment, string company)
    {
        var userPart = string.IsNullOrWhiteSpace(engineerName)
            ? engineerId
            : $"{engineerId} - {engineerName}";
        var environmentPart = string.Join(" - ", new[] { environment, company }
            .Where(value => !string.IsNullOrWhiteSpace(value)));

        if (string.IsNullOrWhiteSpace(userPart))
        {
            userPart = "Not configured";
        }

        return string.IsNullOrWhiteSpace(environmentPart)
            ? userPart
            : $"{userPart} | {environmentPart}";
    }

    private static string BuildEntity(string environment, string company)
    {
        var parts = new[] { environment, company }
            .Where(value => !string.IsNullOrWhiteSpace(value?.Trim()))
            .Select(value => value.Trim());

        return string.Join("-", parts);
    }

    private static string BuildProjectLabel(LocalIndent indent)
    {
        var projectId = (indent.ProjectId ?? string.Empty).Trim();
        var projectName = StripRepeatedProjectCode(projectId, indent.ProjectName);

        return string.IsNullOrWhiteSpace(projectName)
            ? projectId
            : $"{projectId} - {projectName}";
    }

    [RelayCommand]
    private async Task LogoutAsync()
    {
        ShowAccountMenu = false;
        SecureStorage.Default.Remove("session_active");
        SecureStorage.Default.Remove("session_expires_at_utc");
        await Shell.Current.GoToAsync("//login");
    }

    private static string StripRepeatedProjectCode(string code, string? value)
    {
        var text = (value ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(text))
        {
            return text;
        }

        if (text.Equals(code, StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        foreach (var separator in new[] { " - ", " – ", " — ", "-", "–", "—" })
        {
            var prefix = code + separator;
            if (text.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return text[prefix.Length..].Trim();
            }
        }

        return text;
    }
}

public class RecentIndentViewModel
{
    public RecentIndentViewModel(LocalIndent indent)
    {
        IndentId = indent.IndentId;
        IndentNo = string.IsNullOrWhiteSpace(indent.OfficialIndentNo)
            ? "IND: Pending ERP Sync"
            : indent.OfficialIndentNo;
        RequestNo = string.IsNullOrWhiteSpace(indent.RequestNo) ? indent.IndentId : indent.RequestNo;
        CreatedAt = indent.CreatedAt;
        DateText = indent.CreatedAt.ToString("dd-MM-yyyy");
        ProjectDisplay = PreferDisplay(indent.ProjectName, indent.ProjectId);
        WarehouseDisplay = string.IsNullOrWhiteSpace(indent.WarehouseId)
            ? (string.IsNullOrWhiteSpace(indent.OrderNo) ? string.Empty : indent.OrderNo)
            : PreferDisplay(indent.WarehouseName, indent.WarehouseId);
        IndentTypeDisplay = indent.IndentType switch
        {
            "IssueReturn" => "Issue Return",
            _ => indent.IndentType
        };
        ProjectLine = BuildProjectLine(indent);
        Status = NormalizeStatusLabel(indent.Status);

        // Badge colours — one step darker for visibility
        StatusColor = indent.Status switch
        {
            "Pending" or "PendingApproval"
                or "ApprovalPending"                        => Color.FromArgb("#FDE68A"),
            "PendingSync"                                   => Color.FromArgb("#FED7AA"),
            "Approved"                                      => Color.FromArgb("#A7F3D0"),
            "Rejected"                                      => Color.FromArgb("#FECACA"),
            "SyncError"                                     => Color.FromArgb("#FECACA"),
            _                                               => Color.FromArgb("#E5E7EB")
        };
        StatusTextColor = indent.Status switch
        {
            "Pending" or "PendingApproval"
                or "ApprovalPending"                        => Color.FromArgb("#B45309"),
            "PendingSync"                                   => Color.FromArgb("#C2410C"),
            "Approved"                                      => Color.FromArgb("#047857"),
            "Rejected"                                      => Color.FromArgb("#B91C1C"),
            "SyncError"                                     => Color.FromArgb("#B91C1C"),
            _                                               => Color.FromArgb("#374151")
        };
        CardBg = indent.Status switch
        {
            "Pending" or "PendingApproval"
                or "ApprovalPending"                        => Color.FromArgb("#FEF3C7"),
            "PendingSync"                                   => Color.FromArgb("#FFEDD5"),
            "Approved"                                      => Color.FromArgb("#D1FAE5"),
            "Rejected"                                      => Color.FromArgb("#FEE2E2"),
            "SyncError"                                     => Color.FromArgb("#FEE2E2"),
            _                                               => Color.FromArgb("#F9FAFB")
        };
        CardAccentColor = indent.Status switch
        {
            "Pending" or "PendingApproval"
                or "ApprovalPending"                        => Color.FromArgb("#F59E0B"),
            "PendingSync"                                   => Color.FromArgb("#EA580C"),
            "Approved"                                      => Color.FromArgb("#10B981"),
            "Rejected"                                      => Color.FromArgb("#DC2626"),
            "SyncError"                                     => Color.FromArgb("#DC2626"),
            _                                               => Color.FromArgb("#CBD5E1")
        };
    }

    public string IndentId { get; }
    public string IndentNo { get; }
    public string RequestNo { get; }
    public DateTime CreatedAt { get; }
    public string DateText { get; }
    public string ProjectDisplay { get; }
    public string WarehouseDisplay { get; }
    public string IndentTypeDisplay { get; }
    public string ProjectLine { get; }
    public string Status { get; }
    public Color StatusColor { get; }
    public Color StatusTextColor { get; }

    public bool HasProject => !string.IsNullOrWhiteSpace(ProjectDisplay);
    public bool HasWarehouse => !string.IsNullOrWhiteSpace(WarehouseDisplay);
    public bool HasIndentType => !string.IsNullOrWhiteSpace(IndentTypeDisplay);
    public Color CardBg { get; }
    public Color CardAccentColor { get; }

    private static string BuildProjectLine(LocalIndent indent)
    {
        var parts = new[]
        {
            PreferDisplay(indent.ProjectName, indent.ProjectId),
            string.IsNullOrWhiteSpace(indent.WarehouseId)
                ? indent.OrderNo
                : PreferDisplay(indent.WarehouseName, indent.WarehouseId),
            indent.IndentType
        };

        return string.Join(" - ", parts.Where(part => !string.IsNullOrWhiteSpace(part)));
    }

    private static string PreferDisplay(string displayValue, string fallbackValue)
    {
        var fallback = (fallbackValue ?? string.Empty).Trim();
        var display = StripRepeatedProjectCode(fallback, displayValue);

        return string.IsNullOrWhiteSpace(display)
            ? fallback
            : display;
    }

    private static string StripRepeatedProjectCode(string code, string? value)
    {
        var text = (value ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(text))
        {
            return text;
        }

        if (text.Equals(code, StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        foreach (var separator in new[] { " - ", " – ", " — ", "-", "–", "—" })
        {
            var prefix = code + separator;
            if (text.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return text[prefix.Length..].Trim();
            }
        }

        return text;
    }

    private static string NormalizeStatusLabel(string status)
    {
        return status switch
        {
            "PendingApproval" => "Approval Pending",
            "ApprovalPending" => "Approval Pending",
            "PendingSync"     => "Pending ERP Sync",
            "SyncError"       => "Sync Error",
            _ => status
        };
    }
}

public partial class StatusFilterViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(BackgroundColor))]
    [NotifyPropertyChangedFor(nameof(TextColor))]
    [NotifyPropertyChangedFor(nameof(BorderColor))]
    private bool _isSelected;

    public StatusFilterViewModel(string label, bool isSelected)
    {
        Label = label;
        IsSelected = isSelected;
    }

    public string Label { get; }

    private Color AccentColor => Label switch
    {
        "Pending"  => Color.FromArgb("#F7931E"),
        "Pending Sync" => Color.FromArgb("#EA580C"),
        "Approved" => Color.FromArgb("#059669"),
        "Rejected" => Color.FromArgb("#DC2626"),
        _          => Color.FromArgb("#1D2B58")
    };

    private Color PastelColor => Label switch
    {
        "Pending"  => Color.FromArgb("#FFFBEB"),
        "Pending Sync" => Color.FromArgb("#FFEDD5"),
        "Approved" => Color.FromArgb("#ECFDF5"),
        "Rejected" => Color.FromArgb("#FEF2F2"),
        _          => Color.FromArgb("#F4F6FB")
    };

    public Color BackgroundColor => IsSelected ? AccentColor : Colors.White;
    public Color TextColor => IsSelected ? Colors.White : AccentColor;
    public Color BorderColor => IsSelected ? AccentColor : Color.FromArgb("#E5EAF2");
}

public partial class AppNotificationViewModel : ObservableObject
{
    public AppNotificationViewModel(AppNotification notification)
    {
        Id = notification.Id;
        IndentNo = notification.IndentNo;
        Title = notification.Title;
        Message = notification.Message;
        Status = notification.Status;
        CreatedAt = notification.CreatedAt;
        IsRead = notification.IsRead;
    }

    public string Id { get; }
    public string IndentNo { get; }
    public string Title { get; }
    public string Message { get; }
    public string Status { get; }
    public DateTime CreatedAt { get; }
    public string MetaText => string.IsNullOrWhiteSpace(Status)
        ? IndentNo
        : $"{IndentNo} - {Status.ToUpperInvariant()}";
    [ObservableProperty] private bool _isRead;

    public Color BackgroundColor => IsRead ? Colors.White : Color.FromArgb("#EFF6FF");
    public Color AccentColor => IsRead ? Color.FromArgb("#E5EAF2") : Color.FromArgb("#2563EB");

    partial void OnIsReadChanged(bool value)
    {
        OnPropertyChanged(nameof(BackgroundColor));
        OnPropertyChanged(nameof(AccentColor));
    }
}

public sealed class ProjectFilterOption
{
    public ProjectFilterOption(string label, string projectId)
    {
        Label = label;
        ProjectId = projectId;
    }

    public string Label { get; }
    public string ProjectId { get; }
}
