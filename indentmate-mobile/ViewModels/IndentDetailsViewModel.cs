using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;
using System.Collections.Specialized;

namespace IndentMate.Mobile.ViewModels;

public partial class IndentDetailsViewModel : BaseViewModel, IQueryAttributable
{
    private readonly DatabaseService _databaseService;
    private readonly SyncService _syncService;
    private LocalIndent? _indent;

    [ObservableProperty] private string _indentId = string.Empty;
    [ObservableProperty] private string _requestNo = string.Empty;
    [ObservableProperty] private string _officialIndentNo = string.Empty;
    [ObservableProperty] private DateTime _indentDate = DateTime.Today;
    [ObservableProperty] private string _projectDisplay = string.Empty;
    [ObservableProperty] private string _warehouseDisplay = string.Empty;
    [ObservableProperty] private string _fromLocation = string.Empty;
    [ObservableProperty] private string _indentType = string.Empty;
    [ObservableProperty] private string _status = "Created";
    [ObservableProperty] private string _toContractor = string.Empty;
    [ObservableProperty] private string _orderDisplay = string.Empty;
    [ObservableProperty] private string _equipmentDisplay = string.Empty;
    [ObservableProperty] private Color _statusColor = Color.FromArgb("#F3F4F6");
    [ObservableProperty] private Color _statusTextColor = Color.FromArgb("#6B7280");
    [ObservableProperty] private Color _cardBg = Colors.White;
    [ObservableProperty] private Color _cardAccentColor = Color.FromArgb("#E5EAF2");

    public ObservableCollection<LocalIndentItem> Items { get; } = new();

    public bool CanEdit =>
        (Status == "Created" && _indent?.IsSynced != true) ||
        Status is "Rejected" or "SyncError";
    public bool IsSerIndent => _indent?.EngineerType == "SER";
    public bool IsSieIndent => !IsSerIndent;

    public string IndentNoDisplay => string.IsNullOrWhiteSpace(OfficialIndentNo)
        ? "Indent No. will be assigned after submission"
        : OfficialIndentNo;

    public Color IndentNoColor => string.IsNullOrWhiteSpace(OfficialIndentNo)
        ? Color.FromArgb("#9AA3AF")
        : Color.FromArgb("#172033");

    public bool HasSyncInfo => Status is "PendingSync" or "SyncError";

    public string SyncStatusDisplay => Status switch
    {
        "PendingSync" => "ERP Sync: Pending",
        "SyncError" => $"ERP Sync: Error — {_indent?.SyncErrorMessage}",
        _ => string.Empty
    };

    public string ItemCountDisplay => $"{Items.Count} added";
    public bool HasNoItems => Items.Count == 0;

    public IndentDetailsViewModel()
        : this(CreateDefaultDatabaseService(), CreateDefaultSyncService())
    {
    }

    public IndentDetailsViewModel(DatabaseService databaseService, SyncService syncService)
    {
        _databaseService = databaseService;
        _syncService = syncService;
        Items.CollectionChanged += OnItemsCollectionChanged;
    }

    private void OnItemsCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        OnPropertyChanged(nameof(ItemCountDisplay));
        OnPropertyChanged(nameof(HasNoItems));
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (query.TryGetValue("indentId", out var value))
        {
            IndentId = Uri.UnescapeDataString(value?.ToString() ?? string.Empty);
            _ = LoadAsync();
        }
    }

    partial void OnStatusChanged(string value)
    {
        // Badge colours — one step darker for visibility
        StatusColor = value switch
        {
            "Created"                                    => Color.FromArgb("#BFDBFE"),
            "Pending" or "PendingApproval"
                or "ApprovalPending"                     => Color.FromArgb("#FDE68A"),
            "PendingSync"                                => Color.FromArgb("#FED7AA"),
            "Approved"                                   => Color.FromArgb("#A7F3D0"),
            "Rejected"                                   => Color.FromArgb("#FECACA"),
            "SyncError"                                  => Color.FromArgb("#FECACA"),
            _                                            => Color.FromArgb("#E5E7EB")
        };
        StatusTextColor = value switch
        {
            "Created"                                    => Color.FromArgb("#1D4ED8"),
            "Pending" or "PendingApproval"
                or "ApprovalPending"                     => Color.FromArgb("#B45309"),
            "PendingSync"                                => Color.FromArgb("#C2410C"),
            "Approved"                                   => Color.FromArgb("#047857"),
            "Rejected"                                   => Color.FromArgb("#B91C1C"),
            "SyncError"                                  => Color.FromArgb("#B91C1C"),
            _                                            => Color.FromArgb("#374151")
        };
        CardBg = value switch
        {
            "Created"                                    => Color.FromArgb("#DBEAFE"),
            "Pending" or "PendingApproval"
                or "ApprovalPending"                     => Color.FromArgb("#FEF3C7"),
            "PendingSync"                                => Color.FromArgb("#FFEDD5"),
            "Approved"                                   => Color.FromArgb("#D1FAE5"),
            "Rejected"                                   => Color.FromArgb("#FEE2E2"),
            "SyncError"                                  => Color.FromArgb("#FEE2E2"),
            _                                            => Color.FromArgb("#F9FAFB")
        };
        CardAccentColor = value switch
        {
            "Created"                                    => Color.FromArgb("#2563EB"),
            "Pending" or "PendingApproval"
                or "ApprovalPending"                     => Color.FromArgb("#F59E0B"),
            "PendingSync"                                => Color.FromArgb("#EA580C"),
            "Approved"                                   => Color.FromArgb("#10B981"),
            "Rejected"                                   => Color.FromArgb("#DC2626"),
            "SyncError"                                  => Color.FromArgb("#DC2626"),
            _                                            => Color.FromArgb("#CBD5E1")
        };
        OnPropertyChanged(nameof(CanEdit));
        OnPropertyChanged(nameof(HasSyncInfo));
        OnPropertyChanged(nameof(SyncStatusDisplay));
    }

    partial void OnOfficialIndentNoChanged(string value)
    {
        OnPropertyChanged(nameof(IndentNoDisplay));
        OnPropertyChanged(nameof(IndentNoColor));
    }

    [RelayCommand]
    private async Task AddItemAsync()
    {
        if (_indent is null) return;
        var route = _indent.EngineerType == "SER" ? "add-item-ser" : "add-item";
        await Shell.Current.GoToAsync($"//{route}?indentId={Uri.EscapeDataString(_indent.IndentId)}");
    }

    [RelayCommand]
    private async Task EditItemAsync(LocalIndentItem? item)
    {
        if (item is null || _indent is null || !CanEdit)
            return;

        var route = _indent.EngineerType == "SER" ? "add-item-ser" : "add-item";
        await Shell.Current.GoToAsync($"//{route}?indentId={Uri.EscapeDataString(_indent.IndentId)}&itemLineId={Uri.EscapeDataString(item.ItemLineId)}");
    }

    [RelayCommand]
    private async Task SubmitAsync()
    {
        await RunBusyAsync(async () =>
        {
            if (_indent is null)
                throw new InvalidOperationException("Indent was not found.");

            if (Items.Count == 0)
                throw new InvalidOperationException("Please add at least one item before submitting.");

            EnsureNoDuplicateItemsForSubmit();

            if (string.IsNullOrWhiteSpace(_indent.RequestNo))
                _indent.RequestNo = $"REQ-{DateTime.UtcNow:yyyyMMddHHmmss}";

            await _databaseService.UpdateIndentAsync(_indent);
            await _databaseService.MarkIndentPendingSyncAsync(_indent.IndentId);
            await _syncService.PushPendingIndentsAsync();

            // Reload to get OfficialIndentNo assigned by ERP after sync
            _indent = await _databaseService.GetIndentByIdAsync(_indent.IndentId);

            var requestId = _indent?.RequestNo ?? IndentId;

            if (_indent?.Status == "SyncError" && !string.IsNullOrWhiteSpace(_indent.SyncErrorMessage))
                throw new InvalidOperationException($"Request ID: {requestId}. Sync error: {_indent.SyncErrorMessage}. The indent was saved locally and will retry automatically.");

            await Shell.Current.GoToAsync(ResolveDashboardRoute(_indent?.EngineerType));
        });
    }

    [RelayCommand]
    private async Task SaveDraftAsync()
    {
        await Shell.Current.GoToAsync(ResolveDashboardRoute(_indent?.EngineerType));
    }

    [RelayCommand]
    private async Task RemoveItemAsync(LocalIndentItem? item)
    {
        if (item is null || _indent is null || !CanEdit)
            return;

        await RunBusyAsync(async () =>
        {
            await _databaseService.DeleteIndentItemAsync(item.ItemLineId);
            Items.Remove(item);
        });
    }

    private async Task LoadAsync()
    {
        await RunBusyAsync(async () =>
        {
            _indent = await _databaseService.GetIndentByIdAsync(IndentId);
            Items.Clear();
            OnPropertyChanged(nameof(CanEdit));

            if (_indent is null)
                return;

            RequestNo = _indent.RequestNo;
            OfficialIndentNo = _indent.OfficialIndentNo ?? string.Empty;
            IndentDate = _indent.CreatedAt;
            ProjectDisplay = PreferDisplay(_indent.ProjectName, _indent.ProjectId);
            WarehouseDisplay = PreferDisplay(_indent.WarehouseName, _indent.WarehouseId);
            FromLocation = PreferDisplay(_indent.FromLocationName, _indent.FromLocationId);
            IndentType = _indent.IndentType;
            Status = _indent.Status;
            ToContractor = PreferDisplay(_indent.ToContractorName, _indent.ToContractorId);
            OrderDisplay = string.IsNullOrWhiteSpace(_indent.OrderNo)
                ? string.Empty
                : $"{_indent.OrderType}: {_indent.OrderNo}";
            EquipmentDisplay = _indent.EquipmentDisplay;
            OnPropertyChanged(nameof(IsSerIndent));
            OnPropertyChanged(nameof(IsSieIndent));
            OnPropertyChanged(nameof(CanEdit));

            var items = await _databaseService.GetItemsForIndentAsync(_indent.IndentId);
            foreach (var item in items)
            {
                Items.Add(item);
            }
        });
    }

    private static DatabaseService CreateDefaultDatabaseService()
    {
        return new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db"));
    }

    private static SyncService CreateDefaultSyncService()
    {
        var databaseService = CreateDefaultDatabaseService();
        return new SyncService(databaseService, new ApiService(), new LNApiService());
    }

    private static string PreferDisplay(string displayValue, string fallbackValue)
    {
        return string.IsNullOrWhiteSpace(displayValue)
            ? fallbackValue
            : displayValue;
    }

    private static string ResolveDashboardRoute(string? engineerType)
    {
        return string.Equals(engineerType, "SER", StringComparison.OrdinalIgnoreCase)
            ? "//ser-dashboard"
            : "//sie-dashboard";
    }

    private void EnsureNoDuplicateItemsForSubmit()
    {
        if (_indent is null)
            return;

        var duplicate = Items
            .GroupBy(item => string.Join("|",
                NormalizeDuplicateKey(_indent.ProjectId),
                NormalizeDuplicateKey(item.MaterialCode),
                NormalizeDuplicateKey(item.LocationId),
                NormalizeDuplicateKey(item.ActivityId),
                NormalizeDuplicateKey(item.BusinessPartnerId)))
            .FirstOrDefault(group => group.Count() > 1);

        if (duplicate is null)
            return;

        var item = duplicate.First();
        throw new InvalidOperationException(
            $"Material {item.MaterialCode} is already added for the same project, location, activity, and contractor.");
    }

    private static string NormalizeDuplicateKey(string? value)
    {
        return (value ?? string.Empty).Trim().ToUpperInvariant();
    }
}
