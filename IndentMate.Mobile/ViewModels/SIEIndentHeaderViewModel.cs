using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class SIEIndentHeaderViewModel : BaseViewModel
{
    private readonly DatabaseService _databaseService;

    public ObservableCollection<LocalProject> Projects { get; } = new();
    public ObservableCollection<string> IndentTypes { get; } = new() { "Issue", "Issue Return" };
    public ObservableCollection<LocalWarehouse> Warehouses { get; } = new();
    public ObservableCollection<SelectionOption> FromLocations { get; } = new();
    public ObservableCollection<SelectionOption> ToContractors { get; } = new();

    [ObservableProperty] private LocalProject? _selectedProject;
    [ObservableProperty] private string _selectedIndentType = "Issue";
    [ObservableProperty] private LocalWarehouse? _selectedWarehouse;
    [ObservableProperty] private SelectionOption? _selectedFromLocation;
    [ObservableProperty] private SelectionOption? _selectedToContractor;
    [ObservableProperty] private bool _isVirtualWarehouse;
    [ObservableProperty] private bool _isAutoWarehouse;
    [ObservableProperty] private string _autoWarehouseDisplay = string.Empty;
    [ObservableProperty] private bool _showProjectOptions;
    [ObservableProperty] private bool _showIndentTypeOptions;
    [ObservableProperty] private bool _showWarehouseOptions;
    [ObservableProperty] private bool _showFromLocationOptions;
    [ObservableProperty] private bool _showToContractorOptions;

    public bool ShowWarehousePicker => !IsAutoWarehouse;
    public bool ShowAutoWarehouse => IsAutoWarehouse;
    public string SelectedProjectDisplay => FormatProject(SelectedProject);
    public string SelectedWarehouseDisplay => FormatWarehouse(SelectedWarehouse);
    public string SelectedFromLocationDisplay => SelectedFromLocation?.DisplayName ?? "Select from location";
    public string SelectedToContractorDisplay => SelectedToContractor?.DisplayName ?? "Select to contractor";

    public SIEIndentHeaderViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")))
    {
    }

    public SIEIndentHeaderViewModel(DatabaseService databaseService)
    {
        _databaseService = databaseService;
        _ = LoadProjectsAsync();
    }

    [RelayCommand]
    private async Task RefreshAsync()
    {
        await LoadProjectsAsync();
    }

    [RelayCommand]
    private async Task CreateRequestAsync()
    {
        await RunBusyAsync(async () =>
        {
            if (SelectedProject is null)
                throw new InvalidOperationException("Please select a project.");

            if (string.IsNullOrWhiteSpace(SelectedIndentType))
                throw new InvalidOperationException("Please select an indent type.");

            if (SelectedWarehouse is null)
                throw new InvalidOperationException("Please select a warehouse.");

            if (SelectedFromLocation is null)
                throw new InvalidOperationException("Please select a from location.");

            if (SelectedToContractor is null)
                throw new InvalidOperationException("Please select a to contractor.");

            var engineerId = await SecureStorage.Default.GetAsync("engineer_id") ?? string.Empty;
            if (string.IsNullOrWhiteSpace(engineerId))
                throw new InvalidOperationException("Engineer is not configured. Please login again.");

            var newId = Guid.NewGuid().ToString();
            await _databaseService.SaveAsync(new LocalIndent
            {
                IndentId = newId,
                RequestNo = $"REQ-{DateTime.UtcNow:yyyyMMddHHmmss}",
                EngineerId = engineerId,
                ProjectId = SelectedProject.ProjectId,
                WarehouseId = SelectedWarehouse.WarehouseCode,
                IndentType = SelectedIndentType == "Issue Return" ? "IssueReturn" : "Issue",
                EngineerType = "SIE",
                FromLocationId = SelectedFromLocation.Id,
                ToContractorId = SelectedToContractor.Id,
                Status = "Created",
                CreatedAt = DateTime.UtcNow,
                IsSynced = false
            });

            await Shell.Current.GoToAsync($"//indent-details?indentId={Uri.EscapeDataString(newId)}");
        });
    }

    [RelayCommand]
    private void SelectProject()
    {
        if (Projects.Count == 0)
            return;

        ToggleDropdown(nameof(ShowProjectOptions));
    }

    [RelayCommand]
    private void SelectIndentType()
    {
        ToggleDropdown(nameof(ShowIndentTypeOptions));
    }

    [RelayCommand]
    private void SelectWarehouse()
    {
        if (IsAutoWarehouse)
            return;

        if (Warehouses.Count == 0)
            return;

        ToggleDropdown(nameof(ShowWarehouseOptions));
    }

    [RelayCommand]
    private void SelectFromLocation()
    {
        if (FromLocations.Count == 0)
            return;

        ToggleDropdown(nameof(ShowFromLocationOptions));
    }

    [RelayCommand]
    private void SelectToContractor()
    {
        if (ToContractors.Count == 0)
            return;

        ToggleDropdown(nameof(ShowToContractorOptions));
    }

    partial void OnSelectedProjectChanged(LocalProject? value)
    {
        ShowProjectOptions = false;
        OnPropertyChanged(nameof(SelectedProjectDisplay));
        _ = ReloadWarehousesAsync();
    }

    partial void OnSelectedWarehouseChanged(LocalWarehouse? value)
    {
        ShowWarehouseOptions = false;
        IsVirtualWarehouse = value?.IsVirtual == true;
        OnPropertyChanged(nameof(SelectedWarehouseDisplay));
        _ = ReloadFromToOptionsAsync();
    }

    partial void OnSelectedIndentTypeChanged(string value)
    {
        ShowIndentTypeOptions = false;
        _ = ReloadFromToOptionsAsync();
    }

    partial void OnSelectedFromLocationChanged(SelectionOption? value)
    {
        ShowFromLocationOptions = false;
        OnPropertyChanged(nameof(SelectedFromLocationDisplay));
    }

    partial void OnSelectedToContractorChanged(SelectionOption? value)
    {
        ShowToContractorOptions = false;
        OnPropertyChanged(nameof(SelectedToContractorDisplay));
    }

    partial void OnIsAutoWarehouseChanged(bool value)
    {
        OnPropertyChanged(nameof(ShowWarehousePicker));
        OnPropertyChanged(nameof(ShowAutoWarehouse));
    }

    private async Task LoadProjectsAsync()
    {
        await RunBusyAsync(async () =>
        {
            var engineerId = await SecureStorage.Default.GetAsync("engineer_id") ?? string.Empty;
            Projects.Clear();

            if (string.IsNullOrWhiteSpace(engineerId))
                return;

            var projects = await _databaseService.GetSieProjectsForEngineerAsync(engineerId);
            if (projects.Count == 0)
            {
                projects = (await _databaseService.GetProjectsForEngineerAsync(engineerId))
                    .Where(project => string.IsNullOrWhiteSpace(project.ResponsibilityCode) || project.ResponsibilityCode == "SIE")
                    .ToList();
            }

            foreach (var project in projects.OrderBy(project => project.ProjectId))
            {
                Projects.Add(project);
            }

            SelectedProject ??= Projects.FirstOrDefault();
        });
    }

    private async Task ReloadWarehousesAsync()
    {
        Warehouses.Clear();
        SelectedWarehouse = null;
        IsAutoWarehouse = false;
        AutoWarehouseDisplay = string.Empty;

        if (SelectedProject is null)
        {
            await ReloadFromToOptionsAsync();
            return;
        }

        var projectCodes = new[] { SelectedProject.ProjectId, SelectedProject.SiteCode }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct()
            .ToList();

        var warehouses = new List<LocalWarehouse>();
        foreach (var code in projectCodes)
        {
            warehouses.AddRange(await _databaseService.GetWarehousesForSiteAsync(code));
        }

        warehouses = warehouses
            .GroupBy(warehouse => warehouse.WarehouseCode)
            .Select(group => group.First())
            .OrderBy(warehouse => warehouse.WarehouseCode)
            .ToList();

        var virtualWarehouses = warehouses.Where(warehouse => warehouse.IsVirtual).ToList();
        if (virtualWarehouses.Count == 1)
        {
            IsAutoWarehouse = true;
            SelectedWarehouse = virtualWarehouses[0];
            AutoWarehouseDisplay = $"{SelectedWarehouse.WarehouseCode} - {SelectedWarehouse.Description}";
            await ReloadFromToOptionsAsync();
            return;
        }

        foreach (var warehouse in warehouses)
        {
            Warehouses.Add(warehouse);
        }

        SelectedWarehouse ??= Warehouses.FirstOrDefault();

        await ReloadFromToOptionsAsync();
    }

    private async Task ReloadFromToOptionsAsync()
    {
        FromLocations.Clear();
        ToContractors.Clear();
        SelectedFromLocation = null;
        SelectedToContractor = null;

        if (SelectedWarehouse is null || SelectedProject is null)
            return;

        var locations = await _databaseService.GetWarehouseLocationsAsync(SelectedWarehouse.WarehouseCode);
        var isIssue = SelectedIndentType == "Issue";

        IEnumerable<LocalWarehouseLocation> fromLocations = locations;
        IEnumerable<LocalWarehouseLocation> toLocations = locations;

        if (IsVirtualWarehouse && isIssue)
        {
            fromLocations = locations.Where(location => IsCategory(location, "Storage"));
            toLocations = locations.Where(location => IsCategory(location, "Employee") || IsCategory(location, "Subcon"));
        }
        else if (IsVirtualWarehouse)
        {
            fromLocations = locations.Where(location => IsCategory(location, "Employee") || IsCategory(location, "Subcon"));
            toLocations = locations.Where(location => IsCategory(location, "Storage"));
        }

        foreach (var location in fromLocations.OrderBy(location => location.LocationCode))
        {
            FromLocations.Add(SelectionOption.FromLocation(location));
        }

        if (IsVirtualWarehouse || !isIssue)
        {
            foreach (var location in toLocations.OrderBy(location => location.LocationCode))
            {
                ToContractors.Add(SelectionOption.FromLocation(location));
            }
        }
        else
        {
            var partners = await _databaseService.GetSubcontractorsForProjectAsync(SelectedProject.ProjectId);
            foreach (var partner in partners.OrderBy(partner => partner.Name))
            {
                ToContractors.Add(SelectionOption.FromBusinessPartner(partner));
            }
        }

        SelectedFromLocation ??= FromLocations.FirstOrDefault();
        SelectedToContractor ??= ToContractors.FirstOrDefault();
    }

    private static bool IsCategory(LocalWarehouseLocation location, string category)
    {
        return string.Equals(location.Category, category, StringComparison.OrdinalIgnoreCase);
    }

    private static string FormatProject(LocalProject? project)
    {
        if (project is null) return "Select project";
        return string.IsNullOrWhiteSpace(project.Description)
            ? project.ProjectId
            : $"{project.ProjectId} - {project.Description}";
    }

    private static string FormatWarehouse(LocalWarehouse? warehouse)
    {
        if (warehouse is null) return "Select warehouse";
        return string.IsNullOrWhiteSpace(warehouse.Description)
            ? warehouse.WarehouseCode
            : $"{warehouse.WarehouseCode} - {warehouse.Description}";
    }

    private void ToggleDropdown(string dropdownName)
    {
        var nextProject = dropdownName == nameof(ShowProjectOptions) && !ShowProjectOptions;
        var nextIndentType = dropdownName == nameof(ShowIndentTypeOptions) && !ShowIndentTypeOptions;
        var nextWarehouse = dropdownName == nameof(ShowWarehouseOptions) && !ShowWarehouseOptions;
        var nextFromLocation = dropdownName == nameof(ShowFromLocationOptions) && !ShowFromLocationOptions;
        var nextToContractor = dropdownName == nameof(ShowToContractorOptions) && !ShowToContractorOptions;

        ShowProjectOptions = nextProject;
        ShowIndentTypeOptions = nextIndentType;
        ShowWarehouseOptions = nextWarehouse;
        ShowFromLocationOptions = nextFromLocation;
        ShowToContractorOptions = nextToContractor;
    }
}

public class SelectionOption
{
    public string Id { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string OptionType { get; init; } = string.Empty;

    public static SelectionOption FromLocation(LocalWarehouseLocation location)
    {
        return new SelectionOption
        {
            Id = location.LocationCode,
            DisplayName = string.IsNullOrWhiteSpace(location.Description)
                ? location.LocationCode
                : $"{location.LocationCode} - {location.Description}",
            OptionType = "Location"
        };
    }

    public static SelectionOption FromBusinessPartner(LocalBusinessPartner partner)
    {
        return new SelectionOption
        {
            Id = partner.BusinessPartnerId,
            DisplayName = string.IsNullOrWhiteSpace(partner.Name)
                ? partner.BusinessPartnerId
                : $"{partner.BusinessPartnerId} - {partner.Name}",
            OptionType = "BusinessPartner"
        };
    }
}
