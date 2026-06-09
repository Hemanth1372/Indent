using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class SIEIndentHeaderViewModel : BaseViewModel
{
    private readonly DatabaseService _databaseService;
    private readonly ApiService _apiService;

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

    public bool ShowWarehousePicker => !IsAutoWarehouse;
    public bool ShowAutoWarehouse => IsAutoWarehouse;

    public SIEIndentHeaderViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")), new ApiService())
    {
    }

    public SIEIndentHeaderViewModel(DatabaseService databaseService)
        : this(databaseService, new ApiService())
    {
    }

    public SIEIndentHeaderViewModel(DatabaseService databaseService, ApiService apiService)
    {
        _databaseService = databaseService;
        _apiService = apiService;
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

    partial void OnSelectedProjectChanged(LocalProject? value)
    {
        _ = ReloadWarehousesAsync();
        _ = ReloadProjectLocationsAsync();
    }

    partial void OnSelectedWarehouseChanged(LocalWarehouse? value)
    {
        IsVirtualWarehouse = value?.IsVirtual == true;
    }

    partial void OnSelectedIndentTypeChanged(string value)
    {
        _ = ReloadContractorsAsync();
    }

    partial void OnSelectedFromLocationChanged(SelectionOption? value)
    {
        _ = ReloadContractorsAsync();
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

            var localProjects = await GetLocalProjectsAsync(engineerId);
            var projects = await GetMergedCurrentProjectsAsync(engineerId, localProjects, "SIE");

            foreach (var project in projects.OrderBy(project => project.ProjectId))
            {
                Projects.Add(project);
            }

            SelectedProject ??= Projects.FirstOrDefault();
        });
    }

    private async Task<List<LocalProject>> GetLocalProjectsAsync(string engineerId)
    {
        var projects = await _databaseService.GetSieProjectsForEngineerAsync(engineerId);
        if (projects.Count != 0)
        {
            return projects;
        }

        return (await _databaseService.GetProjectsForEngineerAsync(engineerId))
            .Where(project => string.IsNullOrWhiteSpace(project.ResponsibilityCode) || project.ResponsibilityCode == "SIE")
            .ToList();
    }

    private async Task<List<LocalProject>> GetMergedCurrentProjectsAsync(
        string engineerId,
        List<LocalProject> localProjects,
        string responsibilityCode)
    {
        try
        {
            var apiProjects = await _apiService.GetCurrentProjectsAsync();
            if (apiProjects.Count == 0)
            {
                return localProjects;
            }

            var localByProjectId = localProjects
                .GroupBy(project => project.ProjectId, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

            var mergedProjects = apiProjects
                .Select(apiProject =>
                {
                    if (!localByProjectId.TryGetValue(apiProject.ProjectId, out var localProject))
                    {
                        apiProject.EngineerId = engineerId;
                        apiProject.ResponsibilityCode = responsibilityCode;
                        return apiProject;
                    }

                    return new LocalProject
                    {
                        ProjectId = localProject.ProjectId,
                        SiteCode = string.IsNullOrWhiteSpace(localProject.SiteCode) ? apiProject.SiteCode : localProject.SiteCode,
                        AddressCode = localProject.AddressCode,
                        Description = string.IsNullOrWhiteSpace(apiProject.Description) ? localProject.Description : apiProject.Description,
                        EngineerId = localProject.EngineerId,
                        ResponsibilityCode = localProject.ResponsibilityCode
                    };
                })
                .ToList();

            var apiProjectIds = mergedProjects
                .Select(project => project.ProjectId)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            mergedProjects.AddRange(localProjects.Where(project => !apiProjectIds.Contains(project.ProjectId)));
            return mergedProjects;
        }
        catch
        {
            return localProjects;
        }
    }

    private async Task ReloadWarehousesAsync()
    {
        Warehouses.Clear();
        SelectedWarehouse = null;
        IsAutoWarehouse = false;
        AutoWarehouseDisplay = string.Empty;

        if (SelectedProject is null)
        {
            await ReloadProjectLocationsAsync();
            return;
        }

        var projectCodes = new[] { SelectedProject.ProjectId, SelectedProject.SiteCode }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct()
            .ToList();

        var warehouses = await GetWarehousesForProjectAsync(projectCodes);

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
            return;
        }

        foreach (var warehouse in warehouses)
        {
            Warehouses.Add(warehouse);
        }

        SelectedWarehouse ??= Warehouses.FirstOrDefault();
    }

    private async Task<List<LocalWarehouse>> GetWarehousesForProjectAsync(List<string> projectCodes)
    {
        try
        {
            var apiWarehouses = await _apiService.GetWarehousesForProjectAsync(projectCodes);
            if (apiWarehouses.Count != 0)
            {
                return apiWarehouses;
            }
        }
        catch
        {
        }

        var localWarehouses = new List<LocalWarehouse>();
        foreach (var code in projectCodes)
        {
            localWarehouses.AddRange(await _databaseService.GetWarehousesForSiteAsync(code));
        }

        return localWarehouses;
    }

    private async Task ReloadProjectLocationsAsync()
    {
        FromLocations.Clear();
        ToContractors.Clear();
        SelectedFromLocation = null;
        SelectedToContractor = null;

        if (SelectedProject is null)
            return;

        var projectCodes = new[] { SelectedProject.ProjectId, SelectedProject.SiteCode }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var locations = await GetProjectLocationsAsync(projectCodes);

        foreach (var location in locations
            .GroupBy(location => location.LocationCode, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(location => location.LocationCode))
        {
            FromLocations.Add(SelectionOption.FromProjectLocation(location));
        }

        SelectedFromLocation = FromLocations.FirstOrDefault();
        await ReloadContractorsAsync();
    }

    private async Task ReloadContractorsAsync()
    {
        ToContractors.Clear();
        SelectedToContractor = null;

        if (SelectedProject is null || SelectedFromLocation is null)
            return;

        var projectCodes = new[] { SelectedProject.ProjectId, SelectedProject.SiteCode }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var partners = await GetContractorsForLocationAsync(projectCodes, SelectedFromLocation.Id);

        foreach (var partner in partners
            .GroupBy(partner => partner.BusinessPartnerId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(partner => partner.Name))
        {
            ToContractors.Add(SelectionOption.FromBusinessPartner(partner));
        }

        if (ToContractors.Count == 0)
        {
            foreach (var projectCode in projectCodes)
            {
                partners.AddRange(await _databaseService.GetSubcontractorsForProjectAsync(projectCode));
            }

            foreach (var partner in partners
                .GroupBy(partner => partner.BusinessPartnerId, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .OrderBy(partner => partner.Name))
            {
                ToContractors.Add(SelectionOption.FromBusinessPartner(partner));
            }
        }

        SelectedToContractor = ToContractors.FirstOrDefault();
    }

    private async Task<List<LocalLocation>> GetProjectLocationsAsync(List<string> projectCodes)
    {
        try
        {
            var apiLocations = await _apiService.GetLocationsForProjectAsync(projectCodes);
            if (apiLocations.Count != 0)
            {
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

        return localLocations;
    }

    private async Task<List<LocalBusinessPartner>> GetContractorsForLocationAsync(
        List<string> projectCodes,
        string locationCode)
    {
        try
        {
            var apiPartners = await _apiService.GetBusinessPartnersForProjectLocationAsync(projectCodes, locationCode);
            if (apiPartners.Count != 0)
            {
                return apiPartners;
            }
        }
        catch
        {
        }

        var localPartners = new List<LocalBusinessPartner>();
        foreach (var projectCode in projectCodes)
        {
            localPartners.AddRange(await _databaseService.GetSubcontractorsForProjectLocationAsync(
                projectCode,
                locationCode));
        }

        return localPartners;
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

    public static SelectionOption FromProjectLocation(LocalLocation location)
    {
        return new SelectionOption
        {
            Id = location.LocationCode,
            DisplayName = string.IsNullOrWhiteSpace(location.Description)
                ? location.LocationCode
                : $"{location.LocationCode} - {location.Description}",
            OptionType = "ProjectLocation"
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
