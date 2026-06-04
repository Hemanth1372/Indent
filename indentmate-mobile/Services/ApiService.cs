using Newtonsoft.Json;
using IndentMate.Mobile.Data;
using System.Net.Http.Headers;
using System.Text;

namespace IndentMate.Mobile.Services;

/// <summary>
/// Handles REST API communication with the IndentMate backend.
/// </summary>
public class ApiService
{
    private readonly HttpClient _httpClient;
    private const string BaseUrl = "http://localhost:4000";

    public ApiService()
    {
        _httpClient = new HttpClient { BaseAddress = new Uri(BaseUrl) };
        _httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
    }

    /// <summary>Sets the JWT Bearer token for authenticated requests.</summary>
    public void SetAuthToken(string token)
    {
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
    }

    /// <summary>Clears the auth token on logout.</summary>
    public void ClearAuthToken()
    {
        _httpClient.DefaultRequestHeaders.Authorization = null;
    }

    /// <summary>Generic GET request. Returns deserialized object or default.</summary>
    public async Task<T?> GetAsync<T>(string endpoint, CancellationToken ct = default)
    {
        await ApplyStoredAuthTokenAsync();
        var response = await _httpClient.GetAsync(endpoint, ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonConvert.DeserializeObject<T>(json);
    }

    /// <summary>Gets the current Project Master rows from the admin API.</summary>
    public async Task<List<LocalProject>> GetCurrentProjectsAsync(CancellationToken ct = default)
    {
        var response = await GetAsync<ProjectMasterListResponse>("/api/projects/options", ct);
        var projects = response?.Data
            .Select(project => new LocalProject
            {
                ProjectId = (project.ProjectCode ?? string.Empty).Trim(),
                SiteCode = (project.ProjectCode ?? string.Empty).Trim(),
                Description = (project.ProjectDescription ?? string.Empty).Trim()
            })
            .Where(project => !string.IsNullOrWhiteSpace(project.ProjectId))
            .ToList() ?? new List<LocalProject>();

        return projects
            .GroupBy(project => project.ProjectId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(project => project.ProjectId)
            .ToList();
    }

    /// <summary>Gets material warehouses for the selected project/site from the admin API.</summary>
    public async Task<List<LocalWarehouse>> GetWarehousesForProjectAsync(
        IEnumerable<string> projectCodes,
        CancellationToken ct = default)
    {
        var codes = projectCodes
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (codes.Count == 0)
        {
            return new List<LocalWarehouse>();
        }

        var queryString = string.Join("&", codes.Select(code => $"projectCode={Uri.EscapeDataString(code)}"));
        var response = await GetAsync<WarehouseMasterListResponse>($"/api/warehouses/options?{queryString}", ct);
        var warehouses = response?.Data
            .Select(warehouse => new LocalWarehouse
            {
                WarehouseCode = (warehouse.WarehouseCode ?? string.Empty).Trim(),
                Description = (warehouse.WarehouseDescription ?? string.Empty).Trim(),
                SiteCode = (warehouse.ProjectSite ?? string.Empty).Trim(),
                IsMaterialWH = IsYes(warehouse.IsMaterialWarehouse),
                IsVirtual = IsYes(warehouse.IsVirtualWarehouse)
            })
            .Where(warehouse => !string.IsNullOrWhiteSpace(warehouse.WarehouseCode))
            .ToList() ?? new List<LocalWarehouse>();

        return warehouses
            .GroupBy(warehouse => warehouse.WarehouseCode, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(warehouse => warehouse.WarehouseCode)
            .ToList();
    }

    /// <summary>Generic POST request. Returns deserialized response or default.</summary>
    public async Task<TResponse?> PostAsync<TRequest, TResponse>(
        string endpoint, TRequest payload, CancellationToken ct = default)
    {
        await ApplyStoredAuthTokenAsync();
        var json = JsonConvert.SerializeObject(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(endpoint, content, ct);
        response.EnsureSuccessStatusCode();
        var responseJson = await response.Content.ReadAsStringAsync(ct);
        return JsonConvert.DeserializeObject<TResponse>(responseJson);
    }

    /// <summary>Generic PUT request.</summary>
    public async Task PutAsync<TRequest>(
        string endpoint, TRequest payload, CancellationToken ct = default)
    {
        await ApplyStoredAuthTokenAsync();
        var json = JsonConvert.SerializeObject(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PutAsync(endpoint, content, ct);
        response.EnsureSuccessStatusCode();
    }

    private async Task ApplyStoredAuthTokenAsync()
    {
        var token = await SecureStorage.Default.GetAsync("jwt_token");

        if (string.IsNullOrWhiteSpace(token))
        {
            ClearAuthToken();
            return;
        }

        SetAuthToken(token);
    }

    private sealed class ProjectMasterListResponse
    {
        [JsonProperty("data")]
        public List<ProjectMasterRow> Data { get; set; } = new();
    }

    private sealed class ProjectMasterRow
    {
        [JsonProperty("project_code")]
        public string? ProjectCode { get; set; }

        [JsonProperty("project_description")]
        public string? ProjectDescription { get; set; }
    }

    private sealed class WarehouseMasterListResponse
    {
        [JsonProperty("data")]
        public List<WarehouseMasterRow> Data { get; set; } = new();
    }

    private sealed class WarehouseMasterRow
    {
        [JsonProperty("warehouse_code")]
        public string? WarehouseCode { get; set; }

        [JsonProperty("warehouse_description")]
        public string? WarehouseDescription { get; set; }

        [JsonProperty("project_site")]
        public string? ProjectSite { get; set; }

        [JsonProperty("is_material_warehouse")]
        public string? IsMaterialWarehouse { get; set; }

        [JsonProperty("is_virtual_warehouse")]
        public string? IsVirtualWarehouse { get; set; }
    }

    private static bool IsYes(string? value)
    {
        return string.Equals(value?.Trim(), "Yes", StringComparison.OrdinalIgnoreCase);
    }
}
