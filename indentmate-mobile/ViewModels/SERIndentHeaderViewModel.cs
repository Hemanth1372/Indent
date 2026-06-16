using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class SERIndentHeaderViewModel : BaseViewModel
{
    private const int SearchPageSize = 80;
    private readonly DatabaseService _databaseService;
    private readonly ApiService _apiService;
    private int _orderOffset;
    private int _orderSearchVersion;
    private bool _lastOrderHasMore;
    private string _orderSearchText = string.Empty;

    public ObservableCollection<LocalProject> Projects { get; } = new();
    public ObservableCollection<SEROrderOption> Orders { get; } = new();
    public ObservableCollection<string> IndentTypes { get; } = new() { "Issue", "Issue Return" };

    [ObservableProperty] private LocalProject? _selectedProject;
    [ObservableProperty] private SEROrderOption? _selectedOrder;
    [ObservableProperty] private string _equipment = string.Empty;
    [ObservableProperty] private string _selectedIndentType = "Issue";
    [ObservableProperty] private string _userInfo = string.Empty;
    [ObservableProperty] private bool _isOrderSearchLoading;
    [ObservableProperty] private bool _hasMoreOrders;

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
                ProjectName = DisplayOrId(SelectedProject.DisplayName, SelectedProject.ProjectId),
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
        Orders.Clear();
        SelectedOrder = null;
        Equipment = string.Empty;
        HasMoreOrders = false;
        _ = SearchOrdersAsync(string.Empty);
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
            var engineerName = await SecureStorage.Default.GetAsync("engineer_name") ?? string.Empty;
            var environment = await SecureStorage.Default.GetAsync("ln_environment") ?? string.Empty;
            var company = await SecureStorage.Default.GetAsync("company") ?? string.Empty;
            UserInfo = BuildUserInfo(engineerId, engineerName, environment, company);

            Projects.Clear();

            if (string.IsNullOrWhiteSpace(engineerId))
                return;

            var localProjects = await GetLocalProjectsAsync(engineerId);
            var projects = await GetMergedCurrentProjectsAsync(engineerId, localProjects, "SER");

            foreach (var project in projects.OrderBy(project => project.ProjectId))
            {
                Projects.Add(project);
            }

            if (SelectedProject is null || !Projects.Any(project =>
                    string.Equals(project.ProjectId, SelectedProject.ProjectId, StringComparison.OrdinalIgnoreCase)))
            {
                SelectedProject = Projects.FirstOrDefault();
            }
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
            .Where(project => string.IsNullOrWhiteSpace(project.ResponsibilityCode) || NormalizeRole(project.ResponsibilityCode) == "SER")
            .ToList();
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

    [RelayCommand]
    private async Task SearchOrdersAsync(string? search)
    {
        var query = (search ?? string.Empty).Trim();
        _orderSearchText = query;
        _orderOffset = 0;
        HasMoreOrders = false;

        if (SelectedProject is null)
            return;

        var version = ++_orderSearchVersion;
        await LoadOrderPageAsync(query, reset: true, version);
    }

    [RelayCommand]
    private async Task LoadMoreOrdersAsync(string? search)
    {
        var query = string.IsNullOrWhiteSpace(search) ? _orderSearchText : search.Trim();

        if (!HasMoreOrders || IsOrderSearchLoading)
            return;

        var version = ++_orderSearchVersion;
        await LoadOrderPageAsync(query, reset: false, version);
    }

    private async Task LoadOrderPageAsync(string query, bool reset, int version)
    {
        if (SelectedProject is null)
            return;

        IsOrderSearchLoading = true;
        try
        {
            var projectCodes = BuildProjectCodes();
            var offset = reset ? 0 : _orderOffset;
            var orderOptions = await GetCurrentOrderOptionsAsync(projectCodes, query, SearchPageSize, offset);

            if (version != _orderSearchVersion)
                return;

            if (reset)
                Orders.Clear();

            AddOrders(orderOptions);
            _orderOffset = offset + orderOptions.Count;
            HasMoreOrders = _lastOrderHasMore;

            if (reset && string.IsNullOrWhiteSpace(query) && (SelectedOrder is null || !Orders.Any(order =>
                    string.Equals(order.OrderNo, SelectedOrder.OrderNo, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(order.OrderType, SelectedOrder.OrderType, StringComparison.OrdinalIgnoreCase))))
            {
                SelectedOrder = Orders.FirstOrDefault();
            }
        }
        catch
        {
            StatusMessage = "Could not search service/rental orders. Please try again.";
            HasError = true;
        }
        finally
        {
            if (version == _orderSearchVersion)
                IsOrderSearchLoading = false;
        }
    }

    private List<string> BuildProjectCodes()
    {
        if (SelectedProject is null)
        {
            return new List<string>();
        }

        return new[] { SelectedProject.ProjectId, SelectedProject.SiteCode }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private void AddOrders(IEnumerable<SEROrderOption> orderOptions)
    {
        foreach (var order in orderOptions
            .GroupBy(order => $"{order.OrderType}:{order.OrderNo}", StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(order => order.OrderNo))
        {
            if (!Orders.Any(existing =>
                    string.Equals(existing.OrderNo, order.OrderNo, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(existing.OrderType, order.OrderType, StringComparison.OrdinalIgnoreCase)))
            {
                Orders.Add(order);
            }
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

        var orderOptions = await GetCurrentOrderOptionsAsync(projectCodes);

        foreach (var order in orderOptions
            .GroupBy(order => $"{order.OrderType}:{order.OrderNo}", StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(order => order.OrderNo))
        {
            Orders.Add(order);
        }

        SelectedOrder = Orders.FirstOrDefault();
    }

    private async Task<List<SEROrderOption>> GetCurrentOrderOptionsAsync(
        List<string> projectCodes,
        string search = "",
        int limit = 500,
        int offset = 0)
    {
        _lastOrderHasMore = false;

        try
        {
            var apiResult = await _apiService.SearchOrderOptionsForProjectAsync(projectCodes, search, limit, offset);
            if (apiResult.Data.Count != 0)
            {
                await CacheApiOrdersAsync(apiResult.Data);
                _lastOrderHasMore = apiResult.HasMore;
                return apiResult.Data.Select(SEROrderOption.FromApiOrder).ToList();
            }

            if (offset > 0)
            {
                _lastOrderHasMore = false;
                return new List<SEROrderOption>();
            }
        }
        catch
        {
        }

        var orderOptions = new List<SEROrderOption>();
        foreach (var code in projectCodes)
        {
            var serviceOrders = await _databaseService.GetReleasedServiceOrdersForSiteAsync(code);
            orderOptions.AddRange(serviceOrders.Select(SEROrderOption.FromServiceOrder));

            var rentalOrders = await _databaseService.GetReleasedRentalOrdersForProjectAsync(code);
            orderOptions.AddRange(rentalOrders.Select(SEROrderOption.FromRentalOrder));
        }

        var localRows = orderOptions
            .GroupBy(order => $"{order.OrderType}:{order.OrderNo}", StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .Where(order => MatchesSearch(order, search))
            .OrderBy(order => order.OrderNo)
            .Skip(offset)
            .Take(limit + 1)
            .ToList();

        _lastOrderHasMore = localRows.Count > limit;
        return localRows.Take(limit).ToList();
    }

    private static bool MatchesSearch(SEROrderOption order, string search)
    {
        if (string.IsNullOrWhiteSpace(search))
            return true;

        return order.OrderNo.Contains(search, StringComparison.OrdinalIgnoreCase) ||
               order.OrderType.Contains(search, StringComparison.OrdinalIgnoreCase) ||
               order.EquipmentDisplay.Contains(search, StringComparison.OrdinalIgnoreCase) ||
               order.DisplayName.Contains(search, StringComparison.OrdinalIgnoreCase);
    }

    private async Task CacheApiOrdersAsync(List<ApiOrderOption> apiOrders)
    {
        var serviceOrders = apiOrders
            .Where(order => string.Equals(order.OrderType, "Service", StringComparison.OrdinalIgnoreCase))
            .Select(order => new LocalServiceOrder
            {
                OrderNo = order.OrderNo,
                Status = string.IsNullOrWhiteSpace(order.Status) ? "Released" : order.Status,
                SiteCode = order.ProjectCode,
                SerialNumber = order.SerialNumber,
                Equipment = order.ItemCode,
                Description = DisplayOrId(order.OrderDescription, order.ItemDescription)
            })
            .ToList();

        var rentalOrders = apiOrders
            .Where(order => string.Equals(order.OrderType, "Rental", StringComparison.OrdinalIgnoreCase))
            .Select(order => new LocalRentalOrder
            {
                OrderNo = order.OrderNo,
                Status = string.IsNullOrWhiteSpace(order.Status) ? "Released" : order.Status,
                SiteCode = order.ProjectCode,
                ProjectCode = order.ProjectCode,
                SerialNumber = order.SerialNumber,
                Equipment = order.ItemCode,
                Description = DisplayOrId(order.OrderDescription, order.ItemDescription)
            })
            .ToList();

        if (serviceOrders.Count != 0)
        {
            await _databaseService.SaveBatchAsync(serviceOrders);
        }

        if (rentalOrders.Count != 0)
        {
            await _databaseService.SaveBatchAsync(rentalOrders);
        }
    }

    private static string DisplayOrId(string? displayName, string id)
    {
        return string.IsNullOrWhiteSpace(displayName)
            ? id
            : displayName.Trim();
    }

    private static string BuildUserInfo(string engineerId, string engineerName, string environment, string company)
    {
        var userPart = string.IsNullOrWhiteSpace(engineerName)
            ? engineerId
            : $"{engineerId} — {engineerName}";
        var envPart = string.Join(" - ", new[] { environment, company }
            .Where(v => !string.IsNullOrWhiteSpace(v)));

        if (string.IsNullOrWhiteSpace(userPart)) userPart = "Not configured";
        return string.IsNullOrWhiteSpace(envPart) ? userPart : $"{userPart} | {envPart}";
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

    public static SEROrderOption FromApiOrder(ApiOrderOption order)
    {
        return Create(
            order.OrderNo,
            order.OrderType,
            string.IsNullOrWhiteSpace(order.OrderDescription) ? order.ItemDescription : order.OrderDescription,
            order.ItemCode,
            order.SerialNumber,
            string.IsNullOrWhiteSpace(order.Status) ? "Released" : order.Status);
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
