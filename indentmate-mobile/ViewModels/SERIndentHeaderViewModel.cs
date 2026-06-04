using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class SERIndentHeaderViewModel : BaseViewModel
{
    private readonly DatabaseService _databaseService;
    private readonly ApiService _apiService;

    public ObservableCollection<LocalProject> Projects { get; } = new();
    public ObservableCollection<SEROrderOption> Orders { get; } = new();
    public ObservableCollection<string> IndentTypes { get; } = new() { "Issue", "Issue Return" };

    [ObservableProperty] private LocalProject? _selectedProject;
    [ObservableProperty] private SEROrderOption? _selectedOrder;
    [ObservableProperty] private string _equipment = string.Empty;
    [ObservableProperty] private string _selectedIndentType = "Issue";

    public SERIndentHeaderViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")), new ApiService())
    {
    }

    public SERIndentHeaderViewModel(DatabaseService databaseService)
        : this(databaseService, new ApiService())
    {
    }

    public SERIndentHeaderViewModel(DatabaseService databaseService, ApiService apiService)
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

            if (SelectedOrder is null)
                throw new InvalidOperationException("Please select a service or rental order.");

            if (string.IsNullOrWhiteSpace(SelectedIndentType))
                throw new InvalidOperationException("Please select an indent type.");

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
                IndentType = SelectedIndentType == "Issue Return" ? "IssueReturn" : "Issue",
                EngineerType = "SER",
                OrderNo = SelectedOrder.OrderNo,
                OrderType = SelectedOrder.OrderType,
                EquipmentDisplay = SelectedOrder.EquipmentDisplay,
                Status = "Created",
                CreatedAt = DateTime.UtcNow,
                IsSynced = false
            });

            await Shell.Current.GoToAsync($"//indent-details?indentId={Uri.EscapeDataString(newId)}");
        });
    }

    partial void OnSelectedProjectChanged(LocalProject? value)
    {
        _ = LoadOrdersAsync();
    }

    partial void OnSelectedOrderChanged(SEROrderOption? value)
    {
        Equipment = value?.EquipmentDisplay ?? string.Empty;
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
            var projects = await GetMergedCurrentProjectsAsync(engineerId, localProjects, "SER");

            foreach (var project in projects.OrderBy(project => project.ProjectId))
            {
                Projects.Add(project);
            }

            SelectedProject ??= Projects.FirstOrDefault();
        });
    }

    private async Task<List<LocalProject>> GetLocalProjectsAsync(string engineerId)
    {
        var projects = await _databaseService.GetSerProjectsForEngineerAsync(engineerId);
        if (projects.Count != 0)
        {
            return projects;
        }

        return (await _databaseService.GetProjectsForEngineerAsync(engineerId))
            .Where(project => string.IsNullOrWhiteSpace(project.ResponsibilityCode) || project.ResponsibilityCode == "SER")
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

    private async Task LoadOrdersAsync()
    {
        Orders.Clear();
        SelectedOrder = null;
        Equipment = string.Empty;

        if (SelectedProject is null)
            return;

        var projectCodes = new[] { SelectedProject.ProjectId, SelectedProject.SiteCode }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Distinct()
            .ToList();

        var orderOptions = new List<SEROrderOption>();
        foreach (var code in projectCodes)
        {
            var serviceOrders = await _databaseService.GetReleasedServiceOrdersForSiteAsync(code);
            orderOptions.AddRange(serviceOrders.Select(SEROrderOption.FromServiceOrder));

            var rentalOrders = await _databaseService.GetReleasedRentalOrdersForProjectAsync(code);
            orderOptions.AddRange(rentalOrders.Select(SEROrderOption.FromRentalOrder));
        }

        foreach (var order in orderOptions
            .GroupBy(order => $"{order.OrderType}:{order.OrderNo}")
            .Select(group => group.First())
            .OrderBy(order => order.OrderNo))
        {
            Orders.Add(order);
        }

        SelectedOrder ??= Orders.FirstOrDefault();
    }

}

public class SEROrderOption
{
    public string OrderNo { get; init; } = string.Empty;
    public string OrderType { get; init; } = string.Empty;
    public string EquipmentDisplay { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;

    public static SEROrderOption FromServiceOrder(LocalServiceOrder order)
    {
        return Create(order.OrderNo, "Service", order.Description, order.Equipment, order.SerialNumber, order.Status);
    }

    public static SEROrderOption FromRentalOrder(LocalRentalOrder order)
    {
        return Create(order.OrderNo, "Rental", order.Description, order.Equipment, order.SerialNumber, order.Status);
    }

    private static SEROrderOption Create(
        string orderNo,
        string orderType,
        string description,
        string equipment,
        string serialNumber,
        string status)
    {
        var equipmentDisplay = string.Join(" - ", new[] { description, equipment, serialNumber }
            .Where(part => !string.IsNullOrWhiteSpace(part)));

        return new SEROrderOption
        {
            OrderNo = orderNo,
            OrderType = orderType,
            EquipmentDisplay = equipmentDisplay,
            DisplayName = $"{orderNo} | {equipmentDisplay} | {status}"
        };
    }
}
