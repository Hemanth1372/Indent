using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class IndentDetailsViewModel : BaseViewModel, IQueryAttributable
{
    private readonly DatabaseService _databaseService;
    private readonly ApiService _apiService;
    private LocalIndent? _indent;

    [ObservableProperty] private string _indentId = string.Empty;
    [ObservableProperty] private string _indentNo = "DRAFT";
    [ObservableProperty] private DateTime _indentDate = DateTime.Today;
    [ObservableProperty] private string _projectDisplay = string.Empty;
    [ObservableProperty] private string _fromLocation = string.Empty;
    [ObservableProperty] private string _indentType = string.Empty;
    [ObservableProperty] private string _status = "Created";
    [ObservableProperty] private string _toContractor = string.Empty;
    [ObservableProperty] private string _orderDisplay = string.Empty;
    [ObservableProperty] private string _equipmentDisplay = string.Empty;
    [ObservableProperty] private Color _statusColor = Color.FromArgb("#6B7280");

    public ObservableCollection<LocalIndentItem> Items { get; } = new();
    public bool CanEdit => Status is "Created" or "Rejected";
    public bool IsSerIndent => _indent?.EngineerType == "SER";
    public bool IsSieIndent => !IsSerIndent;

    public IndentDetailsViewModel()
        : this(
            new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")),
            new ApiService())
    {
    }

    public IndentDetailsViewModel(DatabaseService databaseService, ApiService apiService)
    {
        _databaseService = databaseService;
        _apiService = apiService;
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
        StatusColor = value switch
        {
            "PendingApproval" => Color.FromArgb("#1565D8"),
            "Approved" => Color.FromArgb("#16A34A"),
            "Rejected" => Color.FromArgb("#D92D20"),
            _ => Color.FromArgb("#6B7280")
        };
        OnPropertyChanged(nameof(CanEdit));
    }

    [RelayCommand]
    private async Task AddItemAsync()
    {
        if (_indent is null) return;
        var route = _indent.EngineerType == "SER" ? "add-item-ser" : "add-item";
        await Shell.Current.GoToAsync($"//{route}?indentId={Uri.EscapeDataString(_indent.IndentId)}");
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

            if (Items.Count > 20)
                throw new InvalidOperationException("Maximum 20 line items allowed per indent.");

            _indent.Status = "PendingApproval";
            _indent.SubmittedAt = DateTime.UtcNow;
            await _databaseService.UpdateIndentAsync(_indent);

            var payload = new
            {
                requestNo = _indent.RequestNo,
                engineerId = _indent.EngineerId,
                projectId = _indent.ProjectId,
                warehouseId = _indent.WarehouseId,
                indentType = _indent.IndentType,
                engineerType = _indent.EngineerType,
                orderNo = _indent.OrderNo,
                orderType = _indent.OrderType,
                equipmentDisplay = _indent.EquipmentDisplay,
                status = _indent.Status,
                submittedAt = _indent.SubmittedAt,
                items = Items.Select(item => new
                {
                    materialCode = item.MaterialCode,
                    materialDesc = item.MaterialDesc,
                    workType = item.WorkType,
                    activityId = item.ActivityId,
                    locationId = item.LocationId,
                    uom = item.UoM,
                    requestedQty = item.RequestedQty,
                    remarks = item.Remarks,
                    attachmentUrl = item.AttachmentUrl
                }).ToList()
            };

            try
            {
                await _apiService.PostAsync<object, object>("/api/indents", payload);
                _indent.IsSynced = true;
                await _databaseService.UpdateIndentAsync(_indent);
            }
            catch
            {
                _indent.IsSynced = false;
                await _databaseService.UpdateIndentAsync(_indent);
            }

            await LoadAsync();
            await Shell.Current.GoToAsync("//home");
        });
    }

    [RelayCommand]
    private async Task SaveDraftAsync()
    {
        await Shell.Current.GoToAsync("//home");
    }

    private async Task LoadAsync()
    {
        await RunBusyAsync(async () =>
        {
            _indent = await _databaseService.GetIndentByIdAsync(IndentId);
            Items.Clear();

            if (_indent is null)
                return;

            IndentNo = _indent.RequestNo;
            IndentDate = _indent.CreatedAt;
            ProjectDisplay = _indent.ProjectId;
            FromLocation = _indent.FromLocationId;
            IndentType = _indent.IndentType;
            Status = _indent.Status;
            ToContractor = _indent.ToContractorId;
            OrderDisplay = string.IsNullOrWhiteSpace(_indent.OrderNo)
                ? string.Empty
                : $"{_indent.OrderType}: {_indent.OrderNo}";
            EquipmentDisplay = _indent.EquipmentDisplay;
            OnPropertyChanged(nameof(IsSerIndent));
            OnPropertyChanged(nameof(IsSieIndent));

            var items = await _databaseService.GetItemsForIndentAsync(_indent.IndentId);
            foreach (var item in items)
            {
                Items.Add(item);
            }
        });
    }
}
