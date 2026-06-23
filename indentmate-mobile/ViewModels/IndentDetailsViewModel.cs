using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;
using System.Net;
using System.Text;

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
    [ObservableProperty] private string _status = "Incomplete";
    [ObservableProperty] private string _toContractor = string.Empty;
    [ObservableProperty] private string _orderDisplay = string.Empty;
    [ObservableProperty] private string _equipmentDisplay = string.Empty;
    [ObservableProperty] private Color _statusColor = Color.FromArgb("#F3F4F6");
    [ObservableProperty] private Color _statusTextColor = Color.FromArgb("#6B7280");
    [ObservableProperty] private Color _cardBg = Colors.White;
    [ObservableProperty] private Color _cardAccentColor = Color.FromArgb("#E5EAF2");

    public ObservableCollection<LocalIndentItem> Items { get; } = new();

    public bool CanEdit =>
        ((Status is "Incomplete" or "Pending") && _indent?.IsSynced != true) ||
        Status is "Rejected" or "SyncError";
    public bool CanSubmitForApproval => CanEdit && Items.Count > 0 && IsNotBusy;
    public double SubmitButtonOpacity => CanSubmitForApproval ? 1.0 : 0.45;
    public bool CanOpenPdf => Status == "Approved";
    public bool IsSerIndent => _indent?.EngineerType == "SER";
    public bool IsSieIndent => !IsSerIndent;

    public string IndentNoDisplay => string.IsNullOrWhiteSpace(OfficialIndentNo)
        ? Status == "Incomplete"
            ? "Complete the indent"
            : "Indent No. will be assigned after submission"
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
        NotifyItemAndSubmitStateChanged();
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
            "Pending" or "PendingApproval"
                or "ApprovalPending"                     => Color.FromArgb("#FDE68A"),
            "Incomplete"                                 => Color.FromArgb("#E0E7FF"),
            "PendingSync"                                => Color.FromArgb("#FED7AA"),
            "Approved"                                   => Color.FromArgb("#A7F3D0"),
            "Rejected"                                   => Color.FromArgb("#FECACA"),
            "SyncError"                                  => Color.FromArgb("#FECACA"),
            _                                            => Color.FromArgb("#E5E7EB")
        };
        StatusTextColor = value switch
        {
            "Pending" or "PendingApproval"
                or "ApprovalPending"                     => Color.FromArgb("#B45309"),
            "Incomplete"                                 => Color.FromArgb("#4338CA"),
            "PendingSync"                                => Color.FromArgb("#C2410C"),
            "Approved"                                   => Color.FromArgb("#047857"),
            "Rejected"                                   => Color.FromArgb("#B91C1C"),
            "SyncError"                                  => Color.FromArgb("#B91C1C"),
            _                                            => Color.FromArgb("#374151")
        };
        CardBg = value switch
        {
            "Pending" or "PendingApproval"
                or "ApprovalPending"                     => Color.FromArgb("#FEF3C7"),
            "Incomplete"                                 => Color.FromArgb("#EEF2FF"),
            "PendingSync"                                => Color.FromArgb("#FFEDD5"),
            "Approved"                                   => Color.FromArgb("#D1FAE5"),
            "Rejected"                                   => Color.FromArgb("#FEE2E2"),
            "SyncError"                                  => Color.FromArgb("#FEE2E2"),
            _                                            => Color.FromArgb("#F9FAFB")
        };
        CardAccentColor = value switch
        {
            "Pending" or "PendingApproval"
                or "ApprovalPending"                     => Color.FromArgb("#F59E0B"),
            "Incomplete"                                 => Color.FromArgb("#6366F1"),
            "PendingSync"                                => Color.FromArgb("#EA580C"),
            "Approved"                                   => Color.FromArgb("#10B981"),
            "Rejected"                                   => Color.FromArgb("#DC2626"),
            "SyncError"                                  => Color.FromArgb("#DC2626"),
            _                                            => Color.FromArgb("#CBD5E1")
        };
        OnPropertyChanged(nameof(CanEdit));
        OnPropertyChanged(nameof(CanSubmitForApproval));
        OnPropertyChanged(nameof(SubmitButtonOpacity));
        OnPropertyChanged(nameof(CanOpenPdf));
        OnPropertyChanged(nameof(IndentNoDisplay));
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
            {
                ValidationFailed("Please add at least one item before submitting.");
                return;
            }

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

    private void ValidationFailed(string message)
    {
        HasError = true;
        StatusMessage = message;
    }

    [RelayCommand]
    private async Task OpenPdfAsync()
    {
        if (_indent is null || !CanOpenPdf)
            return;

        var fileName = $"{SanitizeFileName(RequestNo)}-indent.html";
        var filePath = Path.Combine(FileSystem.CacheDirectory, fileName);
        await File.WriteAllTextAsync(filePath, BuildPrintableHtml(await LoadLogoDataUriAsync()), Encoding.UTF8);
        await Launcher.Default.OpenAsync(new OpenFileRequest
        {
            File = new ReadOnlyFile(filePath, "text/html"),
            Title = "Indent PDF"
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
        NotifyItemAndSubmitStateChanged();
    }

    private void NotifyItemAndSubmitStateChanged()
    {
        OnPropertyChanged(nameof(ItemCountDisplay));
        OnPropertyChanged(nameof(HasNoItems));
        OnPropertyChanged(nameof(CanSubmitForApproval));
        OnPropertyChanged(nameof(SubmitButtonOpacity));
    }

    private string BuildPrintableHtml(string logoDataUri)
    {
        var itemRows = Items.Select((item, index) => $"""
            <tr>
              <td>{index + 1}</td>
              <td>{Html(item.WorkType)}</td>
              <td>{Html(item.ActivityId)}</td>
              <td>{Html(item.MaterialCode)} - {Html(item.MaterialDesc)}</td>
              <td>{Html(item.UoM)}</td>
              <td>{Html(FormatQuantity(GetApprovedQuantity(item)))}</td>
              <td>{Html(item.Remarks)}</td>
            </tr>
            """);

        var rows = string.Join(Environment.NewLine, itemRows);
        if (string.IsNullOrWhiteSpace(rows))
        {
            rows = "<tr><td colspan=\"7\">No item details found.</td></tr>";
        }

        var logoHtml = string.IsNullOrWhiteSpace(logoDataUri)
            ? "<div class=\"logo-placeholder\">NCC</div>"
            : $"<img class=\"logo\" src=\"{logoDataUri}\" alt=\"NCC\" />";

        return $$"""
            <!doctype html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>{{Html(RequestNo)}} - Indent Details</title>
              <style>
                body { font-family: Arial, sans-serif; color: #111827; margin: 18px 20px; }
                .header { display: grid; grid-template-columns: 140px 1fr 180px; align-items: center; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 12px; }
                .logo { width: 76px; height: 76px; object-fit: contain; }
                .logo-placeholder { width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; color: #0f172a; border: 1px solid #dbe3ef; }
                .document-title { margin: 0; text-align: center; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; }
                .request-no { justify-self: end; text-align: right; font-size: 13px; font-weight: 800; line-height: 1.35; }
                .details { display: grid; grid-template-columns: 1fr 1fr; gap: 42px; margin-bottom: 16px; border-bottom: 1px solid #dbe3ef; padding-bottom: 14px; }
                .detail-row { display: grid; grid-template-columns: 112px 8px 1fr; gap: 6px; margin-bottom: 5px; font-size: 12px; line-height: 1.3; }
                .label, .colon { color: #334155; font-weight: 800; }
                .value { color: #0f172a; font-weight: 600; overflow-wrap: anywhere; }
                h2 { margin: 9px 0 7px; font-size: 14px; }
                table { border-collapse: collapse; width: 100%; font-size: 10px; table-layout: fixed; }
                th { background: #f1f5f9; color: #475569; text-align: left; text-transform: uppercase; letter-spacing: 0.08em; }
                th, td { border: 1px solid #e2e8f0; padding: 6px; vertical-align: top; word-break: break-word; }
                th:nth-child(1), td:nth-child(1) { width: 6%; }
                th:nth-child(2), td:nth-child(2) { width: 12%; }
                th:nth-child(3), td:nth-child(3) { width: 12%; }
                th:nth-child(4), td:nth-child(4) { width: 38%; }
                th:nth-child(5), td:nth-child(5) { width: 8%; }
                th:nth-child(6), td:nth-child(6) { width: 10%; }
                th:nth-child(7), td:nth-child(7) { width: 20%; }
                @media print { body { margin: 12mm; } }
              </style>
            </head>
            <body>
              <header class="header">
                <div>{{logoHtml}}</div>
                <h1 class="document-title">Indent Request Details</h1>
                <div class="request-no">
                  <div>{{Html(RequestNo)}}</div>
                  <div>{{Html(OfficialIndentNo)}}</div>
                </div>
              </header>
              <section class="details">
                <div>
                  {{DetailRow("Project", ProjectDisplay)}}
                  {{DetailRow("Warehouse", IsSieIndent ? WarehouseDisplay : OrderDisplay)}}
                  {{DetailRow("Indent No", OfficialIndentNo)}}
                  {{DetailRow("Date", IndentDate.ToString("dd MMM yyyy, hh:mm tt", CultureInfo.InvariantCulture))}}
                  {{DetailRow("Type", IndentType)}}
                  {{DetailRow("Status", Status)}}
                </div>
                <div>
                  {{DetailRow("From", IsSieIndent ? FromLocation : EquipmentDisplay)}}
                  {{DetailRow("To", ToContractor)}}
                  {{DetailRow("Created By", _indent?.EngineerId ?? string.Empty)}}
                  {{DetailRow("Status By", "-")}}
                  {{DetailRow("Approver", "-")}}
                  {{DetailRow("Delivery", IsSieIndent ? FromLocation : EquipmentDisplay)}}
                </div>
              </section>
              <h2>Item Details</h2>
              <table>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Work Type</th>
                    <th>Activity</th>
                    <th>Material</th>
                    <th>UOM</th>
                    <th>Approved Qty</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>{{rows}}</tbody>
              </table>
              <script>setTimeout(function(){ window.print && window.print(); }, 300);</script>
            </body>
            </html>
            """;
    }

    private static decimal GetApprovedQuantity(LocalIndentItem item)
    {
        return item.RequestedQty;
    }

    private static async Task<string> LoadLogoDataUriAsync()
    {
        try
        {
            await using var stream = await FileSystem.OpenAppPackageFileAsync("ncc_logo.png");
            using var memory = new MemoryStream();
            await stream.CopyToAsync(memory);
            return $"data:image/png;base64,{Convert.ToBase64String(memory.ToArray())}";
        }
        catch
        {
            return string.Empty;
        }
    }

    private static string DetailRow(string label, string value)
    {
        return $"""
            <div class="detail-row">
              <div class="label">{Html(label)}</div>
              <div class="colon">:</div>
              <div class="value">{Html(value)}</div>
            </div>
            """;
    }

    private static string Html(string? value)
    {
        var text = string.IsNullOrWhiteSpace(value) ? "-" : value;
        return WebUtility.HtmlEncode(text);
    }

    private static string FormatQuantity(decimal value)
    {
        return value.ToString("0.###", CultureInfo.InvariantCulture);
    }

    private static string SanitizeFileName(string value)
    {
        var clean = string.IsNullOrWhiteSpace(value) ? "indent" : value;
        foreach (var invalid in Path.GetInvalidFileNameChars())
        {
            clean = clean.Replace(invalid, '-');
        }

        return clean;
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
