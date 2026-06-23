using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;
using System.Net;
using System.Text;
using System.Text.Json;

namespace IndentMate.Mobile.ViewModels;

public sealed class ProjectReviewProjectOption
{
    public string Label { get; init; } = string.Empty;
    public string ProjectCode { get; init; } = string.Empty;
}

public partial class ProjectInchargeDashboardViewModel : BaseViewModel
{
    private readonly ApiService _apiService;
    private List<ProjectReviewIndentSummary> _allIndents = new();

    [ObservableProperty] private string _userName = string.Empty;
    [ObservableProperty] private string _userId = string.Empty;
    [ObservableProperty] private string _userInitials = "PI";
    [ObservableProperty] private string _userEntity = "Project Incharge";
    [ObservableProperty] private bool _showAccountMenu;
    [ObservableProperty] private bool _showNotifications;
    [ObservableProperty] private int _unreadNotificationCount;
    [ObservableProperty] private ProjectReviewProjectOption? _selectedProject;
    [ObservableProperty] private int _pendingCount;
    [ObservableProperty] private int _totalCount;
    [ObservableProperty] private int _approvedCount;
    [ObservableProperty] private int _rejectedCount;

    public ObservableCollection<ProjectReviewProjectOption> Projects { get; } = new();
    public ObservableCollection<AppNotificationViewModel> Notifications { get; } = new();
    public bool HasProjects => Projects.Count > 1;
    public bool HasUnreadNotifications => UnreadNotificationCount > 0;
    public bool HasNotifications => Notifications.Count > 0;
    public bool HasNoNotifications => Notifications.Count == 0;
    public double ProjectFilterWidth => CalculateProjectFilterWidth(Projects.Select(project => project.Label));

    public Color PendingCardBg => PendingCount > 0 ? Color.FromArgb("#FFFBEB") : Colors.White;
    public Color PendingAccentColor => PendingCount > 0 ? Color.FromArgb("#F7931E") : Color.FromArgb("#E5EAF2");
    public Color PendingNumColor => PendingCount > 0 ? Color.FromArgb("#D97706") : Color.FromArgb("#CBD5E1");
    public Color TotalCardBg => TotalCount > 0 ? Color.FromArgb("#F4F6FB") : Colors.White;
    public Color TotalAccentColor => TotalCount > 0 ? Color.FromArgb("#1D2B58") : Color.FromArgb("#E5EAF2");
    public Color TotalNumColor => TotalCount > 0 ? Color.FromArgb("#1D2B58") : Color.FromArgb("#CBD5E1");
    public Color ApprovedCardBg => ApprovedCount > 0 ? Color.FromArgb("#ECFDF5") : Colors.White;
    public Color ApprovedAccentColor => ApprovedCount > 0 ? Color.FromArgb("#059669") : Color.FromArgb("#E5EAF2");
    public Color ApprovedNumColor => ApprovedCount > 0 ? Color.FromArgb("#059669") : Color.FromArgb("#CBD5E1");
    public Color RejectedCardBg => RejectedCount > 0 ? Color.FromArgb("#FEF2F2") : Colors.White;
    public Color RejectedAccentColor => RejectedCount > 0 ? Color.FromArgb("#DC2626") : Color.FromArgb("#E5EAF2");
    public Color RejectedNumColor => RejectedCount > 0 ? Color.FromArgb("#DC2626") : Color.FromArgb("#CBD5E1");

    public ProjectInchargeDashboardViewModel()
        : this(new ApiService())
    {
    }

    public ProjectInchargeDashboardViewModel(ApiService apiService)
    {
        _apiService = apiService;
        Notifications.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasNotifications));
            OnPropertyChanged(nameof(HasNoNotifications));
        };
    }

    partial void OnUnreadNotificationCountChanged(int value)
    {
        OnPropertyChanged(nameof(HasUnreadNotifications));
    }

    public async Task LoadAsync()
    {
        await RunBusyAsync(async () =>
        {
            UserId = await SecureStorage.Default.GetAsync("engineer_id") ?? string.Empty;
            UserName = await SecureStorage.Default.GetAsync("engineer_name") ?? UserId;
            UserInitials = BuildInitials(UserName);
            UserEntity = "Project Incharge";

            await LoadProjectsAsync();
            await LoadIndentsAsync();
            await LoadNotificationsAsync();
        });
    }

    partial void OnSelectedProjectChanged(ProjectReviewProjectOption? value)
    {
        _ = LoadIndentsAsync();
    }

    [RelayCommand]
    private async Task RefreshAsync()
    {
        await LoadAsync();
    }

    [RelayCommand]
    private async Task OpenStatusAsync(string? status)
    {
        var query = new List<string>();
        if (!string.IsNullOrWhiteSpace(SelectedProject?.ProjectCode))
            query.Add($"projectCode={Uri.EscapeDataString(SelectedProject.ProjectCode)}");
        if (!string.IsNullOrWhiteSpace(status))
            query.Add($"status={Uri.EscapeDataString(status)}");

        await Shell.Current.GoToAsync($"//project-incharge-list?{string.Join("&", query)}");
    }

    [RelayCommand]
    private async Task ToggleAccountMenuAsync()
    {
        ShowNotifications = false;
        ShowAccountMenu = !ShowAccountMenu;
    }

    [RelayCommand]
    private void CloseAccountMenu()
    {
        ShowAccountMenu = false;
    }

    [RelayCommand]
    private async Task ToggleNotificationsAsync()
    {
        ShowAccountMenu = false;
        ShowNotifications = !ShowNotifications;
        if (ShowNotifications)
            await LoadNotificationsAsync();
    }

    [RelayCommand]
    private void CloseNotifications()
    {
        ShowNotifications = false;
    }

    [RelayCommand]
    private async Task MarkAllNotificationsReadAsync()
    {
        if (Notifications.Count == 0)
            return;

        await _apiService.MarkAllNotificationsReadAsync();
        foreach (var notification in Notifications)
            notification.IsRead = true;

        UnreadNotificationCount = 0;
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
            UnreadNotificationCount = Math.Max(0, UnreadNotificationCount - 1);

        ShowNotifications = false;
        await Shell.Current.GoToAsync("//project-incharge-list");
    }

    [RelayCommand]
    private async Task LogoutAsync()
    {
        ShowAccountMenu = false;
        SecureStorage.Default.Remove("session_active");
        SecureStorage.Default.Remove("session_expires_at_utc");
        await Shell.Current.GoToAsync("//login");
    }

    private async Task LoadProjectsAsync()
    {
        var currentProjectCode = SelectedProject?.ProjectCode ?? string.Empty;
        Projects.Clear();
        Projects.Add(new ProjectReviewProjectOption { Label = "All Projects", ProjectCode = string.Empty });

        var projectOptions = ReadAssignedProjectOptions();
        try
        {
            var backendProjects = await _apiService.GetProjectReviewProjectsAsync();
            if (backendProjects.Count > 0)
            {
                projectOptions = backendProjects;
                Preferences.Default.Set("project_incharge_projects", JsonSerializer.Serialize(projectOptions));
            }
        }
        catch
        {
            // Keep any cached options if the backend is temporarily unavailable.
        }

        foreach (var project in projectOptions)
        {
            if (!Projects.Any(existing => string.Equals(existing.ProjectCode, project.ProjectCode, StringComparison.OrdinalIgnoreCase)))
                Projects.Add(project);
        }

        SelectedProject = Projects.FirstOrDefault(project =>
            string.Equals(project.ProjectCode, currentProjectCode, StringComparison.OrdinalIgnoreCase))
            ?? Projects.FirstOrDefault();

        OnPropertyChanged(nameof(HasProjects));
        OnPropertyChanged(nameof(ProjectFilterWidth));
    }

    private async Task LoadIndentsAsync()
    {
        if (IsBusy && _allIndents.Count != 0)
            return;

        try
        {
            var result = await _apiService.GetProjectReviewIndentsAsync(SelectedProject?.ProjectCode);
            _allIndents = result.Data;
            HasError = false;
            StatusMessage = string.Empty;
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            _allIndents.Clear();
            HasError = true;
            StatusMessage = "Session expired. Please login again to load Project Incharge data.";
        }

        foreach (var project in _allIndents
            .Where(indent => !string.IsNullOrWhiteSpace(indent.ProjectCode))
            .GroupBy(indent => indent.ProjectCode, StringComparer.OrdinalIgnoreCase)
            .Select(group => new ProjectReviewProjectOption
            {
                ProjectCode = group.Key,
                Label = group.First().ProjectDisplay
            })
            .OrderBy(project => project.Label))
        {
            if (!Projects.Any(existing => string.Equals(existing.ProjectCode, project.ProjectCode, StringComparison.OrdinalIgnoreCase)))
                Projects.Add(project);
        }

        PendingCount = _allIndents.Count(indent => IsPendingStatus(indent.Status));
        TotalCount = _allIndents.Count;
        ApprovedCount = _allIndents.Count(indent => NormalizeStatus(indent.Status) == "APPROVED");
        RejectedCount = _allIndents.Count(indent => NormalizeStatus(indent.Status) == "REJECTED");
        NotifyCountColors();
    }

    private async Task LoadNotificationsAsync()
    {
        try
        {
            var result = await _apiService.GetNotificationsAsync();
            Notifications.Clear();
            foreach (var notification in result.Notifications.Take(8))
                Notifications.Add(new AppNotificationViewModel(notification));

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

    public static List<ProjectReviewProjectOption> ReadAssignedProjectOptions()
    {
        var json = Preferences.Default.Get("project_incharge_projects", "[]");
        try
        {
            return JsonSerializer.Deserialize<List<ProjectReviewProjectOption>>(json) ?? new List<ProjectReviewProjectOption>();
        }
        catch
        {
            Preferences.Default.Remove("project_incharge_projects");
            return new List<ProjectReviewProjectOption>();
        }
    }

    private static bool IsPendingStatus(string status)
    {
        return NormalizeStatus(status) is "CREATED" or "PENDING" or "PENDINGAPPROVAL" or "APPROVALPENDING";
    }

    private static string NormalizeStatus(string status)
    {
        return (status ?? string.Empty).Replace(" ", string.Empty).Trim().ToUpperInvariant();
    }

    private static string BuildInitials(string value)
    {
        var parts = (value ?? string.Empty)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(2)
            .Select(part => part[0].ToString().ToUpperInvariant());

        var initials = string.Concat(parts);
        return string.IsNullOrWhiteSpace(initials) ? "PI" : initials;
    }

    private void NotifyCountColors()
    {
        OnPropertyChanged(nameof(PendingCardBg));
        OnPropertyChanged(nameof(PendingAccentColor));
        OnPropertyChanged(nameof(PendingNumColor));
        OnPropertyChanged(nameof(TotalCardBg));
        OnPropertyChanged(nameof(TotalAccentColor));
        OnPropertyChanged(nameof(TotalNumColor));
        OnPropertyChanged(nameof(ApprovedCardBg));
        OnPropertyChanged(nameof(ApprovedAccentColor));
        OnPropertyChanged(nameof(ApprovedNumColor));
        OnPropertyChanged(nameof(RejectedCardBg));
        OnPropertyChanged(nameof(RejectedAccentColor));
        OnPropertyChanged(nameof(RejectedNumColor));
    }

    private static double CalculateProjectFilterWidth(IEnumerable<string> labels)
    {
        var longestLength = labels
            .Select(label => (label ?? string.Empty).Trim().Length)
            .DefaultIfEmpty(0)
            .Max();

        return Math.Clamp(58 + (longestLength * 7.4), 150, 320);
    }
}

public partial class ProjectInchargeListViewModel : BaseViewModel, IQueryAttributable
{
    private const int PageSize = 20;
    private readonly ApiService _apiService;

    [ObservableProperty] private string _projectCode = string.Empty;
    [ObservableProperty] private string _selectedStatus = string.Empty;
    [ObservableProperty] private string _dateFrom = string.Empty;
    [ObservableProperty] private string _dateTo = string.Empty;
    [ObservableProperty] private DateTime _dateFromValue = DateTime.Today;
    [ObservableProperty] private DateTime _dateToValue = DateTime.Today;
    [ObservableProperty] private bool _showCalendar;
    [ObservableProperty] private string _calendarTitle = "Select Date";
    [ObservableProperty] private string _calendarMonthTitle = string.Empty;
    [ObservableProperty] private DateTime _visibleCalendarMonth = new(DateTime.Today.Year, DateTime.Today.Month, 1);
    private string _activeCalendarTarget = "from";
    [ObservableProperty] private int _page = 1;
    [ObservableProperty] private int _totalPages = 1;
    [ObservableProperty] private int _totalCount;
    [ObservableProperty] private ProjectReviewProjectOption? _selectedProject;

    public ObservableCollection<ProjectReviewIndentSummary> Indents { get; } = new();
    public ObservableCollection<ProjectReviewProjectOption> Projects { get; } = new();
    public ObservableCollection<ProjectReviewCalendarDay> CalendarDays { get; } = new();
    public List<string> StatusOptions { get; } = new() { "All", "Pending", "Approved", "Rejected" };

    public string PageText => $"Page {Page} of {TotalPages}";
    public string DateFromDisplay => string.IsNullOrWhiteSpace(DateFrom) ? "mm/dd/yyyy" : DateFrom;
    public string DateToDisplay => string.IsNullOrWhiteSpace(DateTo) ? "mm/dd/yyyy" : DateTo;
    public Color DateFromTextColor => string.IsNullOrWhiteSpace(DateFrom) ? Color.FromArgb("#667085") : Color.FromArgb("#111827");
    public Color DateToTextColor => string.IsNullOrWhiteSpace(DateTo) ? Color.FromArgb("#667085") : Color.FromArgb("#111827");
    public bool CanGoPrevious => Page > 1;
    public bool CanGoNext => Page < TotalPages;
    public string HeaderTitle => SelectedStatus == "All" ? "Total Indents" : SelectedStatus;
    public string ShowingText
    {
        get
        {
            if (TotalCount == 0)
                return "Showing 0-0 of 0";

            var start = ((Page - 1) * PageSize) + 1;
            var end = Math.Min(TotalCount, start + Indents.Count - 1);
            return $"Showing {start}-{end} of {TotalCount}";
        }
    }

    public ProjectInchargeListViewModel()
        : this(new ApiService())
    {
    }

    public ProjectInchargeListViewModel(ApiService apiService)
    {
        _apiService = apiService;
    }

    partial void OnDateFromChanged(string value)
    {
        OnPropertyChanged(nameof(DateFromDisplay));
        OnPropertyChanged(nameof(DateFromTextColor));
    }

    partial void OnDateToChanged(string value)
    {
        OnPropertyChanged(nameof(DateToDisplay));
        OnPropertyChanged(nameof(DateToTextColor));
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        ProjectCode = Uri.UnescapeDataString(query.TryGetValue("projectCode", out var project) ? project?.ToString() ?? string.Empty : string.Empty);
        SelectedStatus = Uri.UnescapeDataString(query.TryGetValue("status", out var status) ? status?.ToString() ?? string.Empty : string.Empty);
        if (string.IsNullOrWhiteSpace(SelectedStatus))
            SelectedStatus = "All";

        LoadProjects();
        SelectedProject = Projects.FirstOrDefault(option =>
            string.Equals(option.ProjectCode, ProjectCode, StringComparison.OrdinalIgnoreCase))
            ?? Projects.FirstOrDefault();
        _ = LoadAsync(resetPage: true);
    }

    partial void OnSelectedProjectChanged(ProjectReviewProjectOption? value)
    {
        ProjectCode = value?.ProjectCode ?? string.Empty;
    }

    [RelayCommand]
    private async Task LoadAsync(bool resetPage = false)
    {
        if (resetPage)
            Page = 1;

        await RunBusyAsync(async () =>
        {
            var result = await _apiService.GetProjectReviewIndentsAsync(
                ProjectCode,
                SelectedStatus == "All" ? null : SelectedStatus,
                NormalizeDate(DateFrom),
                NormalizeDate(DateTo),
                Page,
                PageSize);

            Indents.Clear();
            foreach (var indent in result.Data)
                Indents.Add(indent);

            TotalCount = result.Total;
            Page = result.Page;
            TotalPages = Math.Max(1, result.TotalPages);
            OnPropertyChanged(nameof(PageText));
            OnPropertyChanged(nameof(CanGoPrevious));
            OnPropertyChanged(nameof(CanGoNext));
            OnPropertyChanged(nameof(ShowingText));
            OnPropertyChanged(nameof(HeaderTitle));
        });
    }

    [RelayCommand]
    private async Task ApplyFiltersAsync()
    {
        await LoadAsync(resetPage: true);
    }

    [RelayCommand]
    private async Task ClearFiltersAsync()
    {
        ProjectCode = string.Empty;
        SelectedProject = Projects.FirstOrDefault();
        SelectedStatus = "All";
        DateFrom = string.Empty;
        DateTo = string.Empty;
        ShowCalendar = false;
        await LoadAsync(resetPage: true);
    }

    [RelayCommand]
    private void OpenCalendar(string? target)
    {
        _activeCalendarTarget = string.Equals(target, "to", StringComparison.OrdinalIgnoreCase) ? "to" : "from";
        CalendarTitle = _activeCalendarTarget == "to" ? "To Date" : "From Date";

        var selectedDate = _activeCalendarTarget == "to"
            ? (DateTime.TryParse(DateTo, out var toDate) ? toDate : DateTime.Today)
            : (DateTime.TryParse(DateFrom, out var fromDate) ? fromDate : DateTime.Today);

        VisibleCalendarMonth = new DateTime(selectedDate.Year, selectedDate.Month, 1);
        BuildCalendarDays(selectedDate);
        ShowCalendar = true;
    }

    [RelayCommand]
    private void CloseCalendar()
    {
        ShowCalendar = false;
    }

    [RelayCommand]
    private void PreviousCalendarMonth()
    {
        VisibleCalendarMonth = VisibleCalendarMonth.AddMonths(-1);
        BuildCalendarDays(GetActiveDate());
    }

    [RelayCommand]
    private void NextCalendarMonth()
    {
        VisibleCalendarMonth = VisibleCalendarMonth.AddMonths(1);
        BuildCalendarDays(GetActiveDate());
    }

    [RelayCommand]
    private void SelectCalendarDay(ProjectReviewCalendarDay? day)
    {
        if (day is null || !day.IsCurrentMonth)
            return;

        if (_activeCalendarTarget == "to")
        {
            DateToValue = day.Date;
            DateTo = day.Date.ToString("MM/dd/yyyy");
        }
        else
        {
            DateFromValue = day.Date;
            DateFrom = day.Date.ToString("MM/dd/yyyy");
        }

        ShowCalendar = false;
    }

    [RelayCommand]
    private async Task NextPageAsync()
    {
        if (!CanGoNext) return;
        Page++;
        await LoadAsync();
    }

    [RelayCommand]
    private async Task PreviousPageAsync()
    {
        if (!CanGoPrevious) return;
        Page--;
        await LoadAsync();
    }

    [RelayCommand]
    private async Task OpenIndentAsync(ProjectReviewIndentSummary? indent)
    {
        if (indent is null) return;
        await Shell.Current.GoToAsync($"//project-incharge-detail?id={Uri.EscapeDataString(indent.Id)}");
    }

    [RelayCommand]
    private async Task BackAsync()
    {
        await Shell.Current.GoToAsync("//project-incharge-dashboard");
    }

    private void LoadProjects()
    {
        Projects.Clear();
        Projects.Add(new ProjectReviewProjectOption { Label = "All Projects", ProjectCode = string.Empty });
        foreach (var project in ProjectInchargeDashboardViewModel.ReadAssignedProjectOptions())
        {
            Projects.Add(project);
        }

        _ = LoadBackendProjectsAsync();
    }

    private async Task LoadBackendProjectsAsync()
    {
        try
        {
            var backendProjects = await _apiService.GetProjectReviewProjectsAsync();
            if (backendProjects.Count == 0)
                return;

            MainThread.BeginInvokeOnMainThread(() =>
            {
                var selectedProjectCode = SelectedProject?.ProjectCode ?? ProjectCode;
                Projects.Clear();
                Projects.Add(new ProjectReviewProjectOption { Label = "All Projects", ProjectCode = string.Empty });
                foreach (var project in backendProjects)
                    Projects.Add(project);

                Preferences.Default.Set("project_incharge_projects", JsonSerializer.Serialize(backendProjects));
                SelectedProject = Projects.FirstOrDefault(option =>
                    string.Equals(option.ProjectCode, selectedProjectCode, StringComparison.OrdinalIgnoreCase))
                    ?? Projects.FirstOrDefault();
            });
        }
        catch
        {
            // Cached project options remain usable if the request fails.
        }
    }

    private static string? NormalizeDate(string value)
    {
        return DateTime.TryParse(value, out var date) ? date.ToString("yyyy-MM-dd") : null;
    }

    private DateTime GetActiveDate()
    {
        var value = _activeCalendarTarget == "to" ? DateTo : DateFrom;
        return DateTime.TryParse(value, out var date) ? date : DateTime.Today;
    }

    private void BuildCalendarDays(DateTime selectedDate)
    {
        CalendarMonthTitle = VisibleCalendarMonth.ToString("MMMM yyyy");
        CalendarDays.Clear();

        var firstOfMonth = VisibleCalendarMonth;
        var startOffset = (int)firstOfMonth.DayOfWeek;
        var firstVisibleDate = firstOfMonth.AddDays(-startOffset);

        for (var i = 0; i < 42; i++)
        {
            var date = firstVisibleDate.AddDays(i);
            CalendarDays.Add(new ProjectReviewCalendarDay(
                date,
                date.Month == VisibleCalendarMonth.Month,
                date.Date == selectedDate.Date));
        }
    }
}

public sealed class ProjectReviewCalendarDay
{
    public ProjectReviewCalendarDay(DateTime date, bool isCurrentMonth, bool isSelected)
    {
        Date = date;
        IsCurrentMonth = isCurrentMonth;
        IsSelected = isSelected;
    }

    public DateTime Date { get; }
    public bool IsCurrentMonth { get; }
    public bool IsSelected { get; }
    public string DayText => Date.Day.ToString();
    public Color TextColor => IsCurrentMonth ? Color.FromArgb("#111827") : Color.FromArgb("#9CA3AF");
    public Color BackgroundColor => IsSelected ? Color.FromArgb("#22D3EE") : Colors.Transparent;
    public Color BorderColor => IsSelected ? Color.FromArgb("#0E7490") : Colors.Transparent;
}

public partial class ProjectInchargeDetailViewModel : BaseViewModel, IQueryAttributable
{
    private readonly ApiService _apiService;
    private ProjectReviewIndentDetail? _indent;

    [ObservableProperty] private string _indentId = string.Empty;
    [ObservableProperty] private string _requestId = string.Empty;
    [ObservableProperty] private string _indentNo = string.Empty;
    [ObservableProperty] private string _status = string.Empty;
    [ObservableProperty] private string _projectDisplay = string.Empty;
    [ObservableProperty] private string _warehouseDisplay = string.Empty;
    [ObservableProperty] private string _fromLocation = string.Empty;
    [ObservableProperty] private string _toDisplay = string.Empty;
    [ObservableProperty] private string _typeDisplay = string.Empty;
    [ObservableProperty] private string _createdBy = string.Empty;
    [ObservableProperty] private DateTime _createdAt;

    public ObservableCollection<ProjectReviewLineItemViewModel> Items { get; } = new();
    public bool IsFinalStatus => NormalizeStatus(Status) is "APPROVED" or "REJECTED" or "ISSUED" or "COMPLETED" or "PARTIALLYISSUED";
    public bool CanApproveReject => !IsFinalStatus && IsNotBusy;

    public ProjectInchargeDetailViewModel()
        : this(new ApiService())
    {
    }

    public ProjectInchargeDetailViewModel(ApiService apiService)
    {
        _apiService = apiService;
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        IndentId = Uri.UnescapeDataString(query.TryGetValue("id", out var id) ? id?.ToString() ?? string.Empty : string.Empty);
        _ = LoadAsync();
    }

    [RelayCommand]
    private async Task LoadAsync()
    {
        await RunBusyAsync(async () =>
        {
            _indent = await _apiService.GetProjectReviewIndentAsync(IndentId);
            if (_indent is null)
                return;

            RequestId = _indent.DisplayRequest;
            IndentNo = _indent.IndentNo;
            Status = _indent.Status;
            ProjectDisplay = _indent.ProjectDisplay;
            WarehouseDisplay = _indent.WarehouseDisplay;
            FromLocation = _indent.SourceLocation;
            ToDisplay = _indent.ToDisplay;
            TypeDisplay = _indent.TypeDisplay;
            CreatedBy = _indent.CreatedByDisplay;
            CreatedAt = _indent.CreatedAt;

            Items.Clear();
            foreach (var item in _indent.Items)
                Items.Add(new ProjectReviewLineItemViewModel(item));

            NotifyStatusState();
        });
    }

    [RelayCommand]
    private async Task ApproveAsync()
    {
        if (_indent is null || IsFinalStatus) return;

        var lines = new List<ProjectReviewApprovalLine>();
        foreach (var item in Items)
        {
            if (!decimal.TryParse(item.ApprovedQtyText, out var approvedQty) || approvedQty < 0)
            {
                HasError = true;
                StatusMessage = $"Enter a valid approved quantity for line {item.LineNumber}.";
                return;
            }

            lines.Add(new ProjectReviewApprovalLine
            {
                Id = item.Id,
                LineNumber = item.LineNumber,
                ApprovedQty = approvedQty
            });
        }

        await UpdateStatusAsync("Approved", lines);
    }

    [RelayCommand]
    private async Task RejectAsync()
    {
        if (_indent is null || IsFinalStatus) return;
        await UpdateStatusAsync("Rejected", null);
    }

    [RelayCommand]
    private async Task OpenPdfAsync()
    {
        if (_indent is null) return;

        var fileName = $"{SanitizeFileName(RequestId)}-review.html";
        var filePath = Path.Combine(FileSystem.CacheDirectory, fileName);
        await File.WriteAllTextAsync(filePath, BuildPrintableHtml(), Encoding.UTF8);
        await Launcher.Default.OpenAsync(new OpenFileRequest("Indent PDF", new ReadOnlyFile(filePath, "text/html")));
    }

    [RelayCommand]
    private async Task BackAsync()
    {
        await Shell.Current.GoToAsync("//project-incharge-list");
    }

    private async Task UpdateStatusAsync(string status, IEnumerable<ProjectReviewApprovalLine>? lines)
    {
        await RunBusyAsync(async () =>
        {
            _indent = await _apiService.UpdateProjectReviewStatusAsync(IndentId, status, lines);
            if (_indent is not null)
            {
                Status = _indent.Status;
                Items.Clear();
                foreach (var item in _indent.Items)
                    Items.Add(new ProjectReviewLineItemViewModel(item));
            }

            NotifyStatusState();
        });
    }

    private void NotifyStatusState()
    {
        OnPropertyChanged(nameof(IsFinalStatus));
        OnPropertyChanged(nameof(CanApproveReject));
    }

    private string BuildPrintableHtml()
    {
        var itemRows = Items.Select(item => $"""
            <tr>
              <td>{item.LineNumber}</td>
              <td>{WebUtility.HtmlEncode(item.WorkType)}</td>
              <td>{WebUtility.HtmlEncode(item.ActivityCode)}</td>
              <td>{WebUtility.HtmlEncode(item.MaterialDisplay)}</td>
              <td>{WebUtility.HtmlEncode(item.UoM)}</td>
              <td>{item.RequiredQty:0.###}</td>
              <td>{WebUtility.HtmlEncode(item.ApprovedQtyText)}</td>
              <td>{item.InProcessQty:0.###}</td>
            </tr>
            """);

        var html = new StringBuilder();
        html.AppendLine("<!doctype html>");
        html.AppendLine("<html><head><meta charset=\"utf-8\">");
        html.AppendLine($"<title>{WebUtility.HtmlEncode(RequestId)}</title>");
        html.AppendLine("<style>");
        html.AppendLine("body { font-family: Arial, sans-serif; color: #172033; padding: 24px; }");
        html.AppendLine("h1 { font-size: 22px; }");
        html.AppendLine(".meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 18px 0; }");
        html.AppendLine(".box { border: 1px solid #d8e0ec; border-radius: 8px; padding: 10px; }");
        html.AppendLine("table { width: 100%; border-collapse: collapse; margin-top: 20px; }");
        html.AppendLine("th, td { border: 1px solid #d8e0ec; padding: 8px; font-size: 12px; text-align: left; }");
        html.AppendLine("th { background: #f4f7fb; }");
        html.AppendLine("</style></head><body onload=\"window.print()\">");
        html.AppendLine($"<h1>{WebUtility.HtmlEncode(RequestId)} <small>{WebUtility.HtmlEncode(Status)}</small></h1>");
        html.AppendLine("<div class=\"meta\">");
        html.AppendLine($"<div class=\"box\"><b>Indent</b><br>{WebUtility.HtmlEncode(IndentNo)}</div>");
        html.AppendLine($"<div class=\"box\"><b>Date</b><br>{CreatedAt:dd MMM yyyy}</div>");
        html.AppendLine($"<div class=\"box\"><b>Project</b><br>{WebUtility.HtmlEncode(ProjectDisplay)}</div>");
        html.AppendLine($"<div class=\"box\"><b>Warehouse</b><br>{WebUtility.HtmlEncode(WarehouseDisplay)}</div>");
        html.AppendLine($"<div class=\"box\"><b>From</b><br>{WebUtility.HtmlEncode(FromLocation)}</div>");
        html.AppendLine($"<div class=\"box\"><b>To</b><br>{WebUtility.HtmlEncode(ToDisplay)}</div>");
        html.AppendLine("</div>");
        html.AppendLine("<table>");
        html.AppendLine("<thead><tr><th>Line</th><th>Work Type</th><th>Activity</th><th>Material</th><th>UOM</th><th>Requested</th><th>Approved</th><th>In Process</th></tr></thead>");
        html.AppendLine($"<tbody>{string.Join(Environment.NewLine, itemRows)}</tbody>");
        html.AppendLine("</table></body></html>");

        return html.ToString();
    }

    private static string NormalizeStatus(string status)
    {
        return (status ?? string.Empty).Replace(" ", string.Empty).Trim().ToUpperInvariant();
    }

    private static string SanitizeFileName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var cleaned = new string((value ?? "indent").Select(ch => invalid.Contains(ch) ? '-' : ch).ToArray());
        return string.IsNullOrWhiteSpace(cleaned) ? "indent" : cleaned;
    }
}

public partial class ProjectReviewLineItemViewModel : ObservableObject
{
    public ProjectReviewLineItemViewModel(ProjectReviewLineItem item)
    {
        Id = item.Id;
        LineNumber = item.LineNumber;
        MaterialDisplay = item.MaterialDisplay;
        WorkType = item.WorkType;
        ActivityCode = item.ActivityCode;
        LocationCode = item.LocationCode;
        UoM = item.UoM;
        RequiredQty = item.RequiredQty;
        InProcessQty = item.InProcessQty;
        IssuedQty = item.IssuedQty;
        OnHandQty = item.OnHandQty;
        Remarks = item.Remarks;
        ApprovedQtyText = item.ApprovedQty.ToString("0.###");
    }

    public string Id { get; }
    public int LineNumber { get; }
    public string MaterialDisplay { get; }
    public string WorkType { get; }
    public string ActivityCode { get; }
    public string LocationCode { get; }
    public string UoM { get; }
    public decimal RequiredQty { get; }
    public decimal InProcessQty { get; }
    public decimal IssuedQty { get; }
    public decimal OnHandQty { get; }
    public string Remarks { get; }

    [ObservableProperty] private string _approvedQtyText = string.Empty;
}
