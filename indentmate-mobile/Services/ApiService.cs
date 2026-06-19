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

    public ApiService()
    {
        _httpClient = new HttpClient { BaseAddress = new Uri(ApiEndpoints.BaseUrl) };
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

    public async Task<UploadedAttachment?> UploadIndentAttachmentAsync(string filePath, string fileName, CancellationToken ct = default)
    {
        await ApplyStoredAuthTokenAsync();

        await using var fileStream = File.OpenRead(filePath);
        using var content = new MultipartFormDataContent();
        using var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        content.Add(fileContent, "file", string.IsNullOrWhiteSpace(fileName) ? Path.GetFileName(filePath) : fileName);

        var response = await _httpClient.PostAsync("/api/indents/attachments", content, ct);
        response.EnsureSuccessStatusCode();
        var responseJson = await response.Content.ReadAsStringAsync(ct);
        var uploadResponse = JsonConvert.DeserializeObject<UploadAttachmentResponse>(responseJson);
        return uploadResponse?.Data;
    }

    public async Task<List<RemoteIndentReference>> GetMyIndentReferencesAsync(CancellationToken ct = default)
    {
        var response = await GetAsync<MyIndentsResponse>("/api/indents/mine", ct);

        return response?.Data
            .Select(indent => new RemoteIndentReference(
                (indent.AppRequestId ?? string.Empty).Trim(),
                (indent.IndentNo ?? string.Empty).Trim(),
                (indent.Status ?? string.Empty).Trim()))
            .ToList() ?? new List<RemoteIndentReference>();
    }

    public async Task<NotificationListResult> GetNotificationsAsync(CancellationToken ct = default)
    {
        var response = await GetAsync<NotificationsResponse>("/api/notifications", ct);
        return new NotificationListResult(response?.Data ?? new List<AppNotification>(), response?.UnreadCount ?? 0);
    }

    public async Task MarkNotificationReadAsync(string notificationId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(notificationId))
            return;

        await PatchAsync($"/api/notifications/{Uri.EscapeDataString(notificationId)}/read", ct);
    }

    public async Task MarkAllNotificationsReadAsync(CancellationToken ct = default)
    {
        await PatchAsync("/api/notifications/read-all", ct);
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

    public async Task PatchAsync(string endpoint, CancellationToken ct = default)
    {
        await ApplyStoredAuthTokenAsync();
        using var request = new HttpRequestMessage(HttpMethod.Patch, endpoint)
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json")
        };
        var response = await _httpClient.SendAsync(request, ct);
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

    private sealed class MyIndentsResponse
    {
        [JsonProperty("data")]
        public List<MyIndentRow> Data { get; set; } = new();
    }

    private sealed class NotificationsResponse
    {
        [JsonProperty("data")]
        public List<AppNotification> Data { get; set; } = new();

        [JsonProperty("unreadCount")]
        public int UnreadCount { get; set; }
    }

    private sealed class UploadAttachmentResponse
    {
        [JsonProperty("data")]
        public UploadedAttachment? Data { get; set; }
    }

    private sealed class MyIndentRow
    {
        [JsonProperty("app_request_id")]
        public string? AppRequestId { get; set; }

        [JsonProperty("indent_no")]
        public string? IndentNo { get; set; }

        [JsonProperty("status")]
        public string? Status { get; set; }
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

    /// <summary>Gets items for the given site codes (and optional warehouse) from the admin API.</summary>
    public async Task<List<LocalItem>> GetItemsForProjectAsync(
        IEnumerable<string> siteCodes,
        string? warehouseCode = null,
        CancellationToken ct = default)
    {
        var codes = NormalizeCodes(siteCodes);

        if (codes.Count == 0)
        {
            return new List<LocalItem>();
        }

        var queryParts = codes.Select(code => $"projectSite={Uri.EscapeDataString(code)}").ToList();

        if (!string.IsNullOrWhiteSpace(warehouseCode))
        {
            queryParts.Add($"warehouseCode={Uri.EscapeDataString(warehouseCode.Trim())}");
        }

        var response = await GetAsync<ItemOptionsListResponse>($"/api/items/options?{string.Join("&", queryParts)}", ct);
        return response?.Data
            .Select(item => new LocalItem
            {
                ItemCode    = (item.ItemCode ?? string.Empty).Trim(),
                Description = (item.ItemDescription ?? string.Empty).Trim(),
                PurchaseUnit = (item.PurchaseUnit ?? "NOS").Trim(),
                UoM         = (item.PurchaseUnit ?? "NOS").Trim(),
                SiteCode    = (item.ProjectSite ?? string.Empty).Trim(),
                OnHandQty   = item.OnHandQty,
            })
            .Where(item => !string.IsNullOrWhiteSpace(item.ItemCode))
            .GroupBy(item => item.ItemCode, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(item => item.ItemCode)
            .ToList() ?? new List<LocalItem>();
    }

    /// <summary>Gets activities for the given project codes from the admin API.</summary>
    public async Task<List<LocalActivity>> GetActivitiesForProjectAsync(
        IEnumerable<string> projectCodes,
        CancellationToken ct = default)
    {
        var codes = NormalizeCodes(projectCodes);

        if (codes.Count == 0)
        {
            return new List<LocalActivity>();
        }

        var queryString = string.Join("&", codes.Select(code => $"projectCode={Uri.EscapeDataString(code)}"));
        var response = await GetAsync<ActivityOptionsListResponse>($"/api/activities/options?{queryString}", ct);
        return response?.Data
            .Select(activity => new LocalActivity
            {
                ActivityId   = (activity.ActivityCode ?? string.Empty).Trim(),
                ProjectId    = (activity.ProjectCode ?? string.Empty).Trim(),
                Description  = (activity.Description ?? string.Empty).Trim(),
                ActivityType = (activity.ActivityType ?? string.Empty).Trim(),
                CapacityType = (activity.CriticalCapacityType ?? string.Empty).Trim(),
                Status       = (activity.WorkAuthStatus ?? "Released").Trim(),
            })
            .Where(activity => !string.IsNullOrWhiteSpace(activity.ActivityId))
            .GroupBy(activity => activity.ActivityId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(activity => activity.ActivityId)
            .ToList() ?? new List<LocalActivity>();
    }

    /// <summary>Searches item options without downloading the full item master.</summary>
    public async Task<PagedApiResult<LocalItem>> SearchItemsForProjectAsync(
        string projectCode,
        string? warehouseCode,
        string search,
        int limit = 50,
        int offset = 0,
        string scope = "project",
        CancellationToken ct = default)
    {
        var normalizedProjectCode = (projectCode ?? string.Empty).Trim();
        var normalizedSearch = (search ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(normalizedProjectCode) && !string.Equals(scope, "all", StringComparison.OrdinalIgnoreCase))
        {
            return PagedApiResult<LocalItem>.Empty;
        }

        var queryParts = new List<string>
        {
            $"projectCode={Uri.EscapeDataString(normalizedProjectCode)}",
            $"search={Uri.EscapeDataString(normalizedSearch)}",
            $"limit={limit}",
            $"offset={offset}",
            $"scope={Uri.EscapeDataString(scope)}"
        };

        if (!string.IsNullOrWhiteSpace(warehouseCode))
        {
            queryParts.Add($"warehouseCode={Uri.EscapeDataString(warehouseCode.Trim())}");
        }

        var response = await GetAsync<PagedItemOptionsListResponse>($"/api/indents/options/items?{string.Join("&", queryParts)}", ct);
        var data = response?.Data
            .Select(item => new LocalItem
            {
                ItemCode = (item.ItemCode ?? string.Empty).Trim(),
                Description = (item.ItemDescription ?? string.Empty).Trim(),
                PurchaseUnit = (item.PurchaseUnit ?? "NOS").Trim(),
                UoM = (item.PurchaseUnit ?? "NOS").Trim(),
                SiteCode = (item.ProjectSite ?? string.Empty).Trim(),
                OnHandQty = item.OnHandQty,
            })
            .Where(item => !string.IsNullOrWhiteSpace(item.ItemCode))
            .GroupBy(item => item.ItemCode, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(item => item.ItemCode)
            .ToList() ?? new List<LocalItem>();

        return new PagedApiResult<LocalItem>(
            data,
            response?.HasMore == true,
            response?.NextOffset ?? offset + data.Count);
    }

    /// <summary>Searches activity options without downloading the full activity master.</summary>
    public async Task<PagedApiResult<LocalActivity>> SearchActivitiesForProjectAsync(
        string projectCode,
        string search,
        int limit = 50,
        int offset = 0,
        CancellationToken ct = default)
    {
        var normalizedProjectCode = (projectCode ?? string.Empty).Trim();
        var normalizedSearch = (search ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(normalizedProjectCode))
        {
            return PagedApiResult<LocalActivity>.Empty;
        }

        var queryParts = new List<string>
        {
            $"projectCode={Uri.EscapeDataString(normalizedProjectCode)}",
            $"search={Uri.EscapeDataString(normalizedSearch)}",
            $"limit={limit}",
            $"offset={offset}"
        };

        var response = await GetAsync<PagedActivityOptionsListResponse>($"/api/indents/options/activities?{string.Join("&", queryParts)}", ct);
        var data = response?.Data
            .Select(activity => new LocalActivity
            {
                ActivityId = (activity.ActivityCode ?? string.Empty).Trim(),
                ProjectId = (activity.ProjectCode ?? string.Empty).Trim(),
                Description = (activity.Description ?? string.Empty).Trim(),
                ActivityType = (activity.ActivityType ?? string.Empty).Trim(),
                CapacityType = (activity.CriticalCapacityType ?? string.Empty).Trim(),
                Status = (activity.WorkAuthStatus ?? "Released").Trim(),
            })
            .Where(activity => !string.IsNullOrWhiteSpace(activity.ActivityId))
            .GroupBy(activity => activity.ActivityId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(activity => activity.ActivityId)
            .ToList() ?? new List<LocalActivity>();

        return new PagedApiResult<LocalActivity>(
            data,
            response?.HasMore == true,
            response?.NextOffset ?? offset + data.Count);
    }

    /// <summary>Gets service and rental order options for the given project codes from the admin API.</summary>
    public async Task<List<ApiOrderOption>> GetOrderOptionsForProjectAsync(
        IEnumerable<string> projectCodes,
        string search = "",
        int limit = 500,
        int offset = 0,
        CancellationToken ct = default)
    {
        var codes = NormalizeCodes(projectCodes);

        if (codes.Count == 0)
        {
            return new List<ApiOrderOption>();
        }

        var queryParts = codes.Select(code => $"projectCode={Uri.EscapeDataString(code)}").ToList();
        queryParts.Add($"search={Uri.EscapeDataString((search ?? string.Empty).Trim())}");
        queryParts.Add($"limit={limit}");
        queryParts.Add($"offset={offset}");

        var response = await GetAsync<OrderOptionsListResponse>($"/api/orders/options?{string.Join("&", queryParts)}", ct);
        return response?.Data ?? new List<ApiOrderOption>();
    }

    public async Task<PagedApiResult<ApiOrderOption>> SearchOrderOptionsForProjectAsync(
        IEnumerable<string> projectCodes,
        string search,
        int limit = 80,
        int offset = 0,
        CancellationToken ct = default)
    {
        var codes = NormalizeCodes(projectCodes);

        if (codes.Count == 0)
        {
            return PagedApiResult<ApiOrderOption>.Empty;
        }

        var queryParts = codes.Select(code => $"projectCode={Uri.EscapeDataString(code)}").ToList();
        queryParts.Add($"search={Uri.EscapeDataString((search ?? string.Empty).Trim())}");
        queryParts.Add($"limit={limit}");
        queryParts.Add($"offset={offset}");

        var response = await GetAsync<PagedOrderOptionsListResponse>($"/api/orders/options?{string.Join("&", queryParts)}", ct);
        var data = response?.Data ?? new List<ApiOrderOption>();

        return new PagedApiResult<ApiOrderOption>(
            data,
            response?.HasMore == true,
            response?.NextOffset ?? offset + data.Count);
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

    private class ItemOptionsListResponse
    {
        [JsonProperty("data")]
        public List<ItemOptionsRow> Data { get; set; } = new();
    }

    private sealed class PagedItemOptionsListResponse : ItemOptionsListResponse
    {
        [JsonProperty("hasMore")]
        public bool HasMore { get; set; }

        [JsonProperty("nextOffset")]
        public int NextOffset { get; set; }
    }

    private sealed class ItemOptionsRow
    {
        [JsonProperty("item_code")]
        public string? ItemCode { get; set; }

        [JsonProperty("item_description")]
        public string? ItemDescription { get; set; }

        [JsonProperty("purchase_unit")]
        public string? PurchaseUnit { get; set; }

        [JsonProperty("item_group")]
        public string? ItemGroup { get; set; }

        [JsonProperty("on_hand_qty")]
        public decimal OnHandQty { get; set; }

        [JsonProperty("project_site")]
        public string? ProjectSite { get; set; }
    }

    private class ActivityOptionsListResponse
    {
        [JsonProperty("data")]
        public List<ActivityOptionsRow> Data { get; set; } = new();
    }

    private sealed class PagedActivityOptionsListResponse : ActivityOptionsListResponse
    {
        [JsonProperty("hasMore")]
        public bool HasMore { get; set; }

        [JsonProperty("nextOffset")]
        public int NextOffset { get; set; }
    }

    private sealed class ActivityOptionsRow
    {
        [JsonProperty("project_code")]
        public string? ProjectCode { get; set; }

        [JsonProperty("activity_code")]
        public string? ActivityCode { get; set; }

        [JsonProperty("description")]
        public string? Description { get; set; }

        [JsonProperty("activity_type")]
        public string? ActivityType { get; set; }

        [JsonProperty("critical_capacity_type")]
        public string? CriticalCapacityType { get; set; }

        [JsonProperty("work_auth_status")]
        public string? WorkAuthStatus { get; set; }
    }

    private class OrderOptionsListResponse
    {
        [JsonProperty("data")]
        public List<ApiOrderOption> Data { get; set; } = new();
    }

    private sealed class PagedOrderOptionsListResponse : OrderOptionsListResponse
    {
        [JsonProperty("hasMore")]
        public bool HasMore { get; set; }

        [JsonProperty("nextOffset")]
        public int NextOffset { get; set; }
    }
}

public sealed class ApiOrderOption
{
    [JsonProperty("order_no")]
    public string OrderNo { get; set; } = string.Empty;

    [JsonProperty("order_type")]
    public string OrderType { get; set; } = string.Empty;

    [JsonProperty("status")]
    public string? Status { get; set; }

    [JsonProperty("project_code")]
    public string ProjectCode { get; set; } = string.Empty;

    [JsonProperty("item_code")]
    public string ItemCode { get; set; } = string.Empty;

    [JsonProperty("item_description")]
    public string? ItemDescription { get; set; }

    [JsonProperty("serial_number")]
    public string? SerialNumber { get; set; }

    [JsonProperty("order_description")]
    public string? OrderDescription { get; set; }
}

public sealed record PagedApiResult<T>(List<T> Data, bool HasMore, int NextOffset)
{
    public static PagedApiResult<T> Empty { get; } = new(new List<T>(), false, 0);
}

public sealed record RemoteIndentReference(string AppRequestId, string IndentNo, string Status);
public sealed record NotificationListResult(List<AppNotification> Notifications, int UnreadCount);
public sealed record UploadedAttachment(
    [property: JsonProperty("name")] string Name,
    [property: JsonProperty("url")] string Url);

public sealed class AppNotification
{
    [JsonProperty("id")]
    public string Id { get; set; } = string.Empty;

    [JsonProperty("indent_no")]
    public string IndentNo { get; set; } = string.Empty;

    [JsonProperty("title")]
    public string Title { get; set; } = string.Empty;

    [JsonProperty("message")]
    public string Message { get; set; } = string.Empty;

    [JsonProperty("status")]
    public string Status { get; set; } = string.Empty;

    [JsonProperty("target_path")]
    public string TargetPath { get; set; } = string.Empty;

    [JsonProperty("is_read")]
    public bool IsRead { get; set; }

    [JsonProperty("created_at")]
    public DateTime CreatedAt { get; set; }
}

public sealed record ApiPostResult<T>(
    HttpStatusCode StatusCode,
    bool IsSuccessStatusCode,
    T? Data,
    string RawBody);
