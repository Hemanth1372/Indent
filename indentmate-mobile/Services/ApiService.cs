using Newtonsoft.Json;
using IndentMate.Mobile.Data;
using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace IndentMate.Mobile.Services;

/// <summary>
/// Handles REST API communication with the IndentMate backend.
/// </summary>
public class ApiService
{
    private readonly HttpClient _httpClient;
    private const string BaseUrl = "https://indentmate.onrender.com";

    public ApiService()
    {
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(BaseUrl),
            Timeout = TimeSpan.FromSeconds(60)
        };
        _httpClient.DefaultRequestHeaders.ConnectionClose = true;
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

    /// <summary>Gets project locations for the selected project/site from the admin API.</summary>
    public async Task<List<LocalLocation>> GetLocationsForProjectAsync(
        IEnumerable<string> projectCodes,
        CancellationToken ct = default)
    {
        var codes = NormalizeCodes(projectCodes);

        if (codes.Count == 0)
        {
            return new List<LocalLocation>();
        }

        var queryString = string.Join("&", codes.Select(code => $"projectCode={Uri.EscapeDataString(code)}"));
        var response = await GetAsync<LocationMasterListResponse>($"/api/locations/options?{queryString}", ct);
        var locations = response?.Data
            .Select(location => new LocalLocation
            {
                ProjectId = (location.ProjectCode ?? string.Empty).Trim(),
                LocationCode = (location.LocationCode ?? string.Empty).Trim(),
                Description = (location.Description ?? string.Empty).Trim()
            })
            .Where(location => !string.IsNullOrWhiteSpace(location.LocationCode))
            .ToList() ?? new List<LocalLocation>();

        return locations
            .GroupBy(location => location.LocationCode, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(location => location.LocationCode)
            .ToList();
    }

    /// <summary>Gets contractors/BPs mapped to the selected project location from the admin API.</summary>
    public async Task<List<LocalBusinessPartner>> GetBusinessPartnersForProjectLocationAsync(
        IEnumerable<string> projectCodes,
        string locationCode,
        CancellationToken ct = default)
    {
        var codes = NormalizeCodes(projectCodes);
        var normalizedLocationCode = (locationCode ?? string.Empty).Trim();

        if (codes.Count == 0 || string.IsNullOrWhiteSpace(normalizedLocationCode))
        {
            return new List<LocalBusinessPartner>();
        }

        var queryParts = codes.Select(code => $"projectCode={Uri.EscapeDataString(code)}").ToList();
        queryParts.Add($"locationCode={Uri.EscapeDataString(normalizedLocationCode)}");
        var response = await GetAsync<BusinessPartnerListResponse>($"/api/business-partners/options?{string.Join("&", queryParts)}", ct);
        var partners = response?.Data
            .Select(partner => new LocalBusinessPartner
            {
                BusinessPartnerId = (partner.BusinessPartnerCode ?? string.Empty).Trim(),
                Name = (partner.BusinessPartnerName ?? string.Empty).Trim(),
                ProjectId = (partner.ProjectCode ?? string.Empty).Trim(),
                LocationCode = (partner.LocationCode ?? string.Empty).Trim(),
                SubcontractorPO = true
            })
            .Where(partner => !string.IsNullOrWhiteSpace(partner.BusinessPartnerId))
            .ToList() ?? new List<LocalBusinessPartner>();

        return partners
            .GroupBy(partner => partner.BusinessPartnerId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(partner => partner.Name)
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

    public async Task<ApiPostResult<TResponse>> PostForResultAsync<TRequest, TResponse>(
        string endpoint, TRequest payload, CancellationToken ct = default)
    {
        await ApplyStoredAuthTokenAsync();
        var json = JsonConvert.SerializeObject(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(endpoint, content, ct);
        var responseJson = await response.Content.ReadAsStringAsync(ct);
        var data = string.IsNullOrWhiteSpace(responseJson)
            ? default
            : JsonConvert.DeserializeObject<TResponse>(responseJson);

        return new ApiPostResult<TResponse>(
            response.StatusCode,
            response.IsSuccessStatusCode,
            data,
            responseJson);
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

    private sealed class LocationMasterListResponse
    {
        [JsonProperty("data")]
        public List<LocationMasterRow> Data { get; set; } = new();
    }

    private sealed class LocationMasterRow
    {
        [JsonProperty("project_code")]
        public string? ProjectCode { get; set; }

        [JsonProperty("location_code")]
        public string? LocationCode { get; set; }

        [JsonProperty("description")]
        public string? Description { get; set; }
    }

    private sealed class BusinessPartnerListResponse
    {
        [JsonProperty("data")]
        public List<BusinessPartnerRow> Data { get; set; } = new();
    }

    private sealed class BusinessPartnerRow
    {
        [JsonProperty("project_code")]
        public string? ProjectCode { get; set; }

        [JsonProperty("location_code")]
        public string? LocationCode { get; set; }

        [JsonProperty("business_partner_code")]
        public string? BusinessPartnerCode { get; set; }

        [JsonProperty("business_partner_name")]
        public string? BusinessPartnerName { get; set; }
    }

    private static List<string> NormalizeCodes(IEnumerable<string> codes)
    {
        return codes
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool IsYes(string? value)
    {
        return string.Equals(value?.Trim(), "Yes", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed record ApiPostResult<T>(
    HttpStatusCode StatusCode,
    bool IsSuccessStatusCode,
    T? Data,
    string RawBody);
