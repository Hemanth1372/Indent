using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class AddItemViewModel : BaseViewModel, IQueryAttributable
{
    private const long MaxAttachmentBytes = 5 * 1024 * 1024;
    private readonly DatabaseService _databaseService;
    private LocalIndent? _indent;
    private LocalProject? _project;
    private LocalWarehouse? _warehouse;

    public List<string> WorkTypes { get; } = new() { "BOQ", "NON-BOQ" };
    public ObservableCollection<LocalLocation> Locations { get; } = new();
    public ObservableCollection<LocalActivity> Activities { get; } = new();
    public ObservableCollection<LocalItem> Materials { get; } = new();

    [ObservableProperty] private string _indentId = string.Empty;
    [ObservableProperty] private string _selectedWorkType = "BOQ";
    [ObservableProperty] private LocalLocation? _selectedLocation;
    [ObservableProperty] private LocalActivity? _selectedActivity;
    [ObservableProperty] private LocalItem? _selectedMaterial;
    [ObservableProperty] private string _uoM = string.Empty;
    [ObservableProperty] private string _requestedQty = string.Empty;
    [ObservableProperty] private string _remarks = string.Empty;
    [ObservableProperty] private bool _isVirtualWarehouse;
    [ObservableProperty] private bool _hasHeaderLocation;
    [ObservableProperty] private string _headerLocationDisplay = string.Empty;
    [ObservableProperty] private string _attachmentName = string.Empty;
    [ObservableProperty] private string _attachmentPath = string.Empty;
    [ObservableProperty] private string _validationMessage = string.Empty;

    public bool HasAttachment => !string.IsNullOrWhiteSpace(AttachmentName);
    public bool HasValidationError => !string.IsNullOrWhiteSpace(ValidationMessage);
    public bool IsWorkTypeEnabled => !IsVirtualWarehouse;
    public bool IsLocationPickerVisible => !HasHeaderLocation;
    public bool IsHeaderLocationVisible => HasHeaderLocation;
    public bool IsActivityEnabled => !IsVirtualWarehouse;

    public AddItemViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")))
    {
    }

    public AddItemViewModel(DatabaseService databaseService)
    {
        _databaseService = databaseService;
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (query.TryGetValue("indentId", out var value))
        {
            IndentId = Uri.UnescapeDataString(value?.ToString() ?? string.Empty);
            _ = LoadAsync();
        }
    }

    partial void OnSelectedWorkTypeChanged(string value)
    {
        _ = LoadActivitiesAsync();
    }

    partial void OnSelectedMaterialChanged(LocalItem? value)
    {
        UoM = value?.PurchaseUnit ?? value?.UoM ?? string.Empty;
    }

    partial void OnIsVirtualWarehouseChanged(bool value)
    {
        OnPropertyChanged(nameof(IsWorkTypeEnabled));
        OnPropertyChanged(nameof(IsActivityEnabled));
        if (value)
        {
            SelectedWorkType = "NON-BOQ";
            SelectedActivity = null;
        }
    }

    partial void OnHasHeaderLocationChanged(bool value)
    {
        OnPropertyChanged(nameof(IsLocationPickerVisible));
        OnPropertyChanged(nameof(IsHeaderLocationVisible));
    }

    partial void OnAttachmentNameChanged(string value)
    {
        OnPropertyChanged(nameof(HasAttachment));
    }

    partial void OnValidationMessageChanged(string value)
    {
        OnPropertyChanged(nameof(HasValidationError));
    }

    [RelayCommand]
    private async Task AttachFileAsync()
    {
        ValidationMessage = string.Empty;

        var action = await Shell.Current.DisplayActionSheet("Attachment", "Cancel", null, "Camera", "Browse File");
        if (action == "Camera")
        {
            var photo = await MediaPicker.Default.CapturePhotoAsync();
            if (photo is not null)
            {
                AttachmentName = photo.FileName;
                AttachmentPath = photo.FullPath ?? string.Empty;
            }
        }
        else if (action == "Browse File")
        {
            var file = await FilePicker.Default.PickAsync();
            if (file is null) return;

            var fileInfo = new FileInfo(file.FullPath);
            if (fileInfo.Exists && fileInfo.Length > MaxAttachmentBytes)
            {
                ValidationMessage = "Attachment size must be 5 MB or less.";
                return;
            }

            AttachmentName = file.FileName;
            AttachmentPath = file.FullPath;
        }
    }

    [RelayCommand]
    private async Task SaveItemAsync()
    {
        ValidationMessage = string.Empty;

        if (_indent is null)
        {
            ValidationMessage = "Indent was not found.";
            return;
        }

        if (string.IsNullOrWhiteSpace(SelectedWorkType))
        {
            ValidationMessage = "Please select a work type.";
            return;
        }

        if (!IsVirtualWarehouse && SelectedActivity is null)
        {
            ValidationMessage = "Please select an activity.";
            return;
        }

        if (!HasHeaderLocation && SelectedLocation is null)
        {
            ValidationMessage = "Please select a location.";
            return;
        }

        if (SelectedMaterial is null)
        {
            ValidationMessage = "Please select a material.";
            return;
        }

        if (!decimal.TryParse(RequestedQty, out var qty) || qty <= 0)
        {
            ValidationMessage = "Requested quantity must be greater than 0.";
            return;
        }

        if (!string.IsNullOrWhiteSpace(Remarks) && !Remarks.All(c => char.IsLetterOrDigit(c) || char.IsWhiteSpace(c)))
        {
            ValidationMessage = "Remarks must be alphanumeric.";
            return;
        }

        await RunBusyAsync(async () =>
        {
            if (await _databaseService.CountItemsForIndentAsync(_indent.IndentId) >= 20)
            {
                await Shell.Current.DisplayAlert("Limit reached", "Maximum 20 items reached", "OK");
                return;
            }

            await _databaseService.SaveAsync(new LocalIndentItem
            {
                ItemLineId = Guid.NewGuid().ToString(),
                IndentId = _indent.IndentId,
                MaterialCode = SelectedMaterial.ItemCode,
                MaterialDesc = SelectedMaterial.Description,
                WorkType = SelectedWorkType,
                ActivityId = IsVirtualWarehouse ? string.Empty : SelectedActivity?.ActivityId ?? string.Empty,
                LocationId = HasHeaderLocation ? _indent.FromLocationId : SelectedLocation?.LocationCode ?? string.Empty,
                UoM = UoM,
                RequestedQty = qty,
                Remarks = Remarks,
                AttachmentUrl = AttachmentPath
            });

            await Shell.Current.GoToAsync($"//indent-details?indentId={Uri.EscapeDataString(_indent.IndentId)}");
        });
    }

    private async Task LoadAsync()
    {
        await RunBusyAsync(async () =>
        {
            _indent = await _databaseService.GetIndentByIdAsync(IndentId);
            if (_indent is null) return;

            _project = await _databaseService.GetProjectAsync(_indent.ProjectId);
            _warehouse = await _databaseService.GetWarehouseAsync(_indent.WarehouseId);
            IsVirtualWarehouse = _warehouse?.IsVirtual == true;
            HasHeaderLocation = !string.IsNullOrWhiteSpace(_indent.FromLocationId);
            HeaderLocationDisplay = _indent.FromLocationId;

            SelectedWorkType = IsVirtualWarehouse ? "NON-BOQ" : "BOQ";

            await LoadLocationsAsync();
            await LoadActivitiesAsync();
            await LoadMaterialsAsync();
        });
    }

    private async Task LoadLocationsAsync()
    {
        Locations.Clear();
        if (_indent is null) return;

        if (HasHeaderLocation)
            return;

        var locations = await _databaseService.GetLocationsForProjectAsync(_indent.ProjectId);
        foreach (var location in locations.OrderBy(l => l.LocationCode))
        {
            Locations.Add(location);
        }
    }

    private async Task LoadActivitiesAsync()
    {
        Activities.Clear();
        SelectedActivity = null;

        if (_indent is null || IsVirtualWarehouse)
            return;

        var activities = await _databaseService.GetActivitiesForProjectAsync(_indent.ProjectId);
        var filtered = activities
            .Where(a => IsReleased(a.Status))
            .Where(a => IsAllowedActivityType(a.ActivityType))
            .Where(a => SelectedWorkType == "BOQ"
                ? !IsSundryOrLabour(a.CapacityType)
                : IsSundryOrLabour(a.CapacityType))
            .OrderBy(a => a.ActivityId);

        foreach (var activity in filtered)
        {
            Activities.Add(activity);
        }
    }

    private async Task LoadMaterialsAsync()
    {
        Materials.Clear();

        if (_indent is null)
            return;

        var siteCode = _project?.SiteCode;
        if (string.IsNullOrWhiteSpace(siteCode))
            siteCode = _indent.ProjectId;

        var materials = await _databaseService.GetItemsForSiteAsync(siteCode);
        foreach (var material in materials.OrderBy(m => m.ItemCode))
        {
            Materials.Add(material);
        }
    }

    private static bool IsReleased(string value) =>
        string.Equals(value, "Released", StringComparison.OrdinalIgnoreCase);

    private static bool IsAllowedActivityType(string value) =>
        string.Equals(value, "Work package", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "WorkPackage", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "Control account", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "ControlAccount", StringComparison.OrdinalIgnoreCase);

    private static bool IsSundryOrLabour(string value) =>
        string.Equals(value, "Sundry Cost", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "SundryCost", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "Labour", StringComparison.OrdinalIgnoreCase);
}
