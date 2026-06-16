using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class AddItemViewModel : BaseViewModel, IQueryAttributable
{
    private const long MaxAttachmentBytes = 5 * 1024 * 1024;
    private const int SearchPageSize = 80;
    private readonly DatabaseService _databaseService;
    private readonly ApiService _apiService;
    private LocalIndent? _indent;
    private LocalProject? _project;
    private LocalWarehouse? _warehouse;
    private bool _initializing;
    private int _activityOffset;
    private int _materialOffset;
    private int _activitySearchVersion;
    private int _materialSearchVersion;
    private string _activitySearchText = string.Empty;
    private string _materialSearchText = string.Empty;

    public List<string> WorkTypes { get; } = new() { "BOQ", "NON-BOQ" };
    public ObservableCollection<LocalLocation> Locations { get; } = new();
    public ObservableCollection<LocalActivity> Activities { get; } = new();
    public ObservableCollection<LocalItem> Materials { get; } = new();
    public ObservableCollection<SelectionOption> BusinessPartners { get; } = new();

    [ObservableProperty] private string _indentId = string.Empty;
    [ObservableProperty] private string _selectedWorkType = "BOQ";
    [ObservableProperty] private LocalLocation? _selectedLocation;
    [ObservableProperty] private LocalActivity? _selectedActivity;
    [ObservableProperty] private LocalItem? _selectedMaterial;
    [ObservableProperty] private SelectionOption? _selectedBusinessPartner;
    [ObservableProperty] private string _uoM = string.Empty;
    [ObservableProperty] private string _requestedQty = string.Empty;
    [ObservableProperty] private string _remarks = string.Empty;
    [ObservableProperty] private bool _isVirtualWarehouse;
    [ObservableProperty] private bool _hasHeaderLocation;
    [ObservableProperty] private string _headerLocationDisplay = string.Empty;
    [ObservableProperty] private string _attachmentName = string.Empty;
    [ObservableProperty] private string _attachmentPath = string.Empty;
    [ObservableProperty] private string _validationMessage = string.Empty;
    [ObservableProperty] private bool _isActivitySearchLoading;
    [ObservableProperty] private bool _hasMoreActivities;
    [ObservableProperty] private bool _isMaterialSearchLoading;
    [ObservableProperty] private bool _hasMoreMaterials;

    public bool HasAttachment => !string.IsNullOrWhiteSpace(AttachmentName);
    public bool HasValidationError => !string.IsNullOrWhiteSpace(ValidationMessage);
    public bool IsWorkTypeEnabled => !IsVirtualWarehouse;
    public bool IsLocationPickerVisible => !HasHeaderLocation;
    public bool IsHeaderLocationVisible => HasHeaderLocation;
    public bool IsActivityEnabled => !IsVirtualWarehouse;

    public AddItemViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")), new ApiService())
    {
    }

    public AddItemViewModel(DatabaseService databaseService)
        : this(databaseService, new ApiService())
    {
    }

    public AddItemViewModel(DatabaseService databaseService, ApiService apiService)
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

    partial void OnSelectedWorkTypeChanged(string value)
    {
        Activities.Clear();
        SelectedActivity = null;
        HasMoreActivities = false;

        if (!_initializing)
        {
            _ = SearchActivitiesAsync(_activitySearchText);
        }
    }

    partial void OnSelectedLocationChanged(LocalLocation? value)
    {
        if (_initializing) return;
        _ = LoadBusinessPartnersAsync();
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
    private async Task AttachCameraAsync()
    {
        ValidationMessage = string.Empty;
        try
        {
            var photo = await MediaPicker.Default.CapturePhotoAsync();
            if (photo is not null)
            {
                AttachmentName = photo.FileName;
                AttachmentPath = photo.FullPath ?? string.Empty;
            }
        }
        catch
        {
            ValidationMessage = "Camera is not available on this device.";
        }
    }

    [RelayCommand]
    private async Task AttachFileAsync()
    {
        ValidationMessage = string.Empty;
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
                await Shell.Current.DisplayAlert("Limit reached", "Maximum 20 items allowed per indent.", "OK");
                return;
            }

            var locationId = HasHeaderLocation ? _indent.FromLocationId : SelectedLocation?.LocationCode ?? string.Empty;
            var activityId = IsVirtualWarehouse ? string.Empty : SelectedActivity?.ActivityId ?? string.Empty;
            var businessPartnerId = SelectedBusinessPartner?.Id ?? string.Empty;

            if (await _databaseService.HasDuplicateSIEItemAsync(
                    _indent.IndentId, SelectedMaterial.ItemCode, locationId, activityId, businessPartnerId))
            {
                ValidationMessage = "An item with the same material, location, activity, and contractor already exists.";
                return;
            }

            await _databaseService.SaveAsync(new LocalIndentItem
            {
                ItemLineId = Guid.NewGuid().ToString(),
                IndentId = _indent.IndentId,
                MaterialCode = SelectedMaterial.ItemCode,
                MaterialDesc = SelectedMaterial.Description,
                WorkType = SelectedWorkType,
                ActivityId = activityId,
                LocationId = locationId,
                UoM = UoM,
                RequestedQty = qty,
                Remarks = Remarks,
                AttachmentUrl = AttachmentPath,
                BusinessPartnerId = businessPartnerId,
                BusinessPartnerName = SelectedBusinessPartner?.DisplayName ?? string.Empty
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
            HeaderLocationDisplay = string.IsNullOrWhiteSpace(_indent.FromLocationName)
                ? _indent.FromLocationId
                : _indent.FromLocationName;

            SelectedWorkType = IsVirtualWarehouse ? "NON-BOQ" : "BOQ";

            _initializing = true;
            try
            {
                await Task.WhenAll(
                    LoadLocationsAsync()
                );
            }
            finally
            {
                _initializing = false;
            }

            Activities.Clear();
            Materials.Clear();
            SelectedActivity = null;
            SelectedMaterial = null;
            HasMoreActivities = false;
            HasMoreMaterials = false;
            await LoadBusinessPartnersAsync();

            if (!IsVirtualWarehouse)
                await SearchActivitiesAsync(string.Empty);

            await SearchMaterialsAsync(string.Empty);
        });
    }

    private async Task LoadLocationsAsync()
    {
        Locations.Clear();
        if (_indent is null) return;

        if (HasHeaderLocation)
            return;

        var locations = await GetCurrentLocationsAsync(BuildProjectCodes());
        foreach (var location in locations.OrderBy(l => l.LocationCode))
        {
            Locations.Add(location);
        }

        SelectedLocation ??= Locations.FirstOrDefault();
    }

    private async Task<List<LocalLocation>> GetCurrentLocationsAsync(List<string> projectCodes)
    {
        try
        {
            var apiLocations = await _apiService.GetLocationsForProjectAsync(projectCodes);
            if (apiLocations.Count != 0)
            {
                await _databaseService.SaveBatchAsync(apiLocations);
                return apiLocations;
            }
        }
        catch
        {
        }

        var localLocations = new List<LocalLocation>();
        foreach (var projectCode in projectCodes)
        {
            localLocations.AddRange(await _databaseService.GetLocationsForProjectAsync(projectCode));
        }

        return localLocations
            .GroupBy(location => location.LocationCode, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(location => location.LocationCode)
            .ToList();
    }

    [RelayCommand]
    private async Task SearchActivitiesAsync(string? search)
    {
        var query = (search ?? string.Empty).Trim();
        _activitySearchText = query;
        _activityOffset = 0;
        HasMoreActivities = false;

        if (_indent is null || IsVirtualWarehouse)
            return;

        var version = ++_activitySearchVersion;
        await LoadActivityPageAsync(query, reset: true, version);
    }

    [RelayCommand]
    private async Task LoadMoreActivitiesAsync(string? search)
    {
        var query = string.IsNullOrWhiteSpace(search) ? _activitySearchText : search.Trim();

        if (!HasMoreActivities || IsActivitySearchLoading)
            return;

        var version = ++_activitySearchVersion;
        await LoadActivityPageAsync(query, reset: false, version);
    }

    [RelayCommand]
    private async Task SearchMaterialsAsync(string? search)
    {
        var query = (search ?? string.Empty).Trim();
        _materialSearchText = query;
        _materialOffset = 0;
        HasMoreMaterials = false;

        if (_indent is null)
            return;

        var version = ++_materialSearchVersion;
        await LoadMaterialPageAsync(query, reset: true, version);
    }

    [RelayCommand]
    private async Task LoadMoreMaterialsAsync(string? search)
    {
        var query = string.IsNullOrWhiteSpace(search) ? _materialSearchText : search.Trim();

        if (!HasMoreMaterials || IsMaterialSearchLoading)
            return;

        var version = ++_materialSearchVersion;
        await LoadMaterialPageAsync(query, reset: false, version);
    }

    private async Task LoadBusinessPartnersAsync()
    {
        BusinessPartners.Clear();
        SelectedBusinessPartner = null;

        if (_indent is null) return;

        var locationCode = HasHeaderLocation
            ? _indent.FromLocationId
            : SelectedLocation?.LocationCode ?? string.Empty;

        if (string.IsNullOrWhiteSpace(locationCode))
            return;

        var projectCodes = BuildProjectCodes();
        var partners = await GetCurrentBusinessPartnersAsync(projectCodes, locationCode);

        foreach (var partner in partners
            .GroupBy(p => p.BusinessPartnerId, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .OrderBy(p => p.Name))
        {
            BusinessPartners.Add(SelectionOption.FromBusinessPartner(partner));
        }

        SelectedBusinessPartner ??= BusinessPartners.FirstOrDefault();
    }

    private async Task<List<LocalBusinessPartner>> GetCurrentBusinessPartnersAsync(
        List<string> projectCodes,
        string locationCode)
    {
        try
        {
            var apiPartners = await _apiService.GetBusinessPartnersForProjectLocationAsync(projectCodes, locationCode);
            if (apiPartners.Count != 0)
            {
                await _databaseService.SaveBatchAsync(apiPartners);
                return apiPartners;
            }
        }
        catch
        {
        }

        var localPartners = new List<LocalBusinessPartner>();
        foreach (var code in projectCodes)
        {
            localPartners.AddRange(
                await _databaseService.GetSubcontractorsForProjectLocationAsync(code, locationCode));
        }

        return localPartners;
    }

    private async Task LoadActivityPageAsync(string query, bool reset, int version)
    {
        if (_indent is null)
            return;

        IsActivitySearchLoading = true;
        try
        {
            var projectCode = GetPrimaryProjectCode();
            var offset = reset ? 0 : _activityOffset;
            var filtered = new List<LocalActivity>();
            var hasMore = false;
            var nextOffset = offset;
            var pageAttempts = 0;

            do
            {
                var result = await _apiService.SearchActivitiesForProjectAsync(projectCode, query, SearchPageSize, nextOffset);
                if (version != _activitySearchVersion)
                    return;

                filtered.AddRange(FilterActivities(result.Data));
                nextOffset = result.NextOffset;
                hasMore = result.HasMore;
                pageAttempts++;
            }
            while (filtered.Count < SearchPageSize && hasMore && pageAttempts < 5);

            if (filtered.Count != 0)
                await _databaseService.SaveBatchAsync(filtered);

            if (version != _activitySearchVersion)
                return;

            if (reset)
                Activities.Clear();

            AddActivities(filtered);
            _activityOffset = nextOffset;
            HasMoreActivities = hasMore;
        }
        catch
        {
            ValidationMessage = "Could not search activities. Please try again.";
        }
        finally
        {
            if (version == _activitySearchVersion)
                IsActivitySearchLoading = false;
        }
    }

    private async Task LoadMaterialPageAsync(string query, bool reset, int version)
    {
        if (_indent is null)
            return;

        IsMaterialSearchLoading = true;
        try
        {
            var projectCode = GetPrimarySiteCode();
            var offset = reset ? 0 : _materialOffset;
            var result = await _apiService.SearchItemsForProjectAsync(projectCode, _indent.WarehouseId, query, SearchPageSize, offset, "project");
            if (version != _materialSearchVersion)
                return;

            if (result.Data.Count != 0)
                await _databaseService.SaveBatchAsync(result.Data);

            if (version != _materialSearchVersion)
                return;

            if (reset)
                Materials.Clear();

            AddMaterials(result.Data);
            _materialOffset = result.NextOffset;
            HasMoreMaterials = result.HasMore;
        }
        catch
        {
            ValidationMessage = "Could not search materials. Please try again.";
        }
        finally
        {
            if (version == _materialSearchVersion)
                IsMaterialSearchLoading = false;
        }
    }

    private IEnumerable<LocalActivity> FilterActivities(IEnumerable<LocalActivity> activities)
    {
        return activities
            .Where(a => IsReleased(a.Status))
            .Where(a => IsAllowedActivityType(a.ActivityType))
            .Where(a => SelectedWorkType == "BOQ"
                ? !IsSundryOrLabour(a.CapacityType)
                : IsSundryOrLabour(a.CapacityType))
            .OrderBy(a => a.ActivityId);
    }

    private void AddActivities(IEnumerable<LocalActivity> activities)
    {
        foreach (var activity in activities)
        {
            if (!Activities.Any(existing =>
                    string.Equals(existing.ActivityId, activity.ActivityId, StringComparison.OrdinalIgnoreCase)))
            {
                Activities.Add(activity);
            }
        }
    }

    private void AddMaterials(IEnumerable<LocalItem> materials)
    {
        foreach (var material in materials.OrderBy(m => m.ItemCode))
        {
            if (!Materials.Any(existing =>
                    string.Equals(existing.ItemCode, material.ItemCode, StringComparison.OrdinalIgnoreCase)))
            {
                Materials.Add(material);
            }
        }
    }

    private string GetPrimaryProjectCode()
    {
        return new[] { _project?.ProjectId, _project?.SiteCode, _indent?.ProjectId }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code!.Trim())
            .FirstOrDefault() ?? string.Empty;
    }

    private string GetPrimarySiteCode()
    {
        return new[] { _project?.SiteCode, _project?.ProjectId, _indent?.ProjectId }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code!.Trim())
            .FirstOrDefault() ?? string.Empty;
    }

    private List<string> BuildProjectCodes()
    {
        if (_indent is null)
        {
            return new List<string>();
        }

        return new[] { _project?.SiteCode, _project?.ProjectId, _indent.ProjectId }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool IsReleased(string value) =>
        string.IsNullOrWhiteSpace(value) ||
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
