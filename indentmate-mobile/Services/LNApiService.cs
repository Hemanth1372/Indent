using Newtonsoft.Json;
using IndentMate.Mobile.Data;
using System.Diagnostics;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;

namespace IndentMate.Mobile.Services;

/// <summary>
/// Service for communicating with Infor LN OData REST endpoints.
/// Handles authentication and data retrieval from LN sessions.
/// </summary>
public class LNApiService
{
    private readonly HttpClient _httpClient;
    private string? _jwtToken;

    public LNApiService()
    {
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(30)
        };
        _httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Authentication
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Authenticates with LN and obtains a JWT Bearer token.
    /// Stores the token internally for subsequent requests.
    /// </summary>
    public async Task<string?> AuthenticateAsync(
        string engineerId,
        string password,
        string lnEnvironment,
        string company,
        CancellationToken ct = default)
    {
        try
        {
            // POST to LN auth endpoint
            var authUrl = $"https://{lnEnvironment}/psp/ps/EMPLOYEE-SELF-SERVICE/EMPL/h/?cmd=login";

            var payload = new
            {
                userId = engineerId,
                password = password
            };

            var json = JsonConvert.SerializeObject(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(authUrl, content, ct);

            if (!response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"LN Auth failed: {response.StatusCode}");
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            var authResponse = JsonConvert.DeserializeObject<LNAuthResponse>(responseJson);

            if (authResponse?.Token != null)
            {
                _jwtToken = authResponse.Token;
                _httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", _jwtToken);
                return _jwtToken;
            }

            return null;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"LN Authentication error: {ex.Message}");
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OData Endpoints
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Gets responsibilities assigned to an employee filtered by SIE/SER.
    /// Session: tppdm6149m000
    /// </summary>
    public async Task<List<LNResponsibility>?> GetResponsibilitiesByEmployeeAsync(
        string employeeCode,
        string lnEnvironment,
        string company,
        CancellationToken ct = default)
    {
        try
        {
            var baseUrl = $"https://{lnEnvironment}//{company}/oa/OData/";
            var session = "tppdm6149m000";

            // Select specific fields
            var fields = "?$select=cprj,cres,emno,vldt";

            // Filter: employee code and responsibility type
            var filter = $"&$filter=emno eq '{employeeCode}' and (cres eq 'SIE' or cres eq 'SER')";

            var endpoint = $"{baseUrl}{session}{fields}{filter}";

            var response = await _httpClient.GetAsync(endpoint, ct);

            if (!response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"GetResponsibilities failed: {response.StatusCode}");
                return new List<LNResponsibility>();
            }

            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonConvert.DeserializeObject<ODataResponse<LNResponsibility>>(json);

            return result?.Value ?? new List<LNResponsibility>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"GetResponsibilities error: {ex.Message}");
            return new List<LNResponsibility>();
        }
    }

    /// <summary>
    /// Gets project information.
    /// Session: tppdm6100m000
    /// </summary>
    public async Task<List<LNProject>?> GetProjectsAsync(
        List<string>? projectCodes,
        string lnEnvironment,
        string company,
        CancellationToken ct = default)
    {
        try
        {
            var baseUrl = $"https://{lnEnvironment}//{company}/oa/OData/";
            var session = "tppdm6100m000";

            // Select specific fields
            var fields = "?$select=cprj,dsca,padr";

            // Build filter if project codes provided
            var filter = "";
            if (projectCodes?.Any() == true)
            {
                var filterConditions = string.Join(" or ", projectCodes.Select(p => $"cprj eq '{p}'"));
                filter = $"&$filter={filterConditions}";
            }

            var endpoint = $"{baseUrl}{session}{fields}{filter}";

            var response = await _httpClient.GetAsync(endpoint, ct);

            if (!response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"GetProjects failed: {response.StatusCode}");
                return new List<LNProject>();
            }

            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonConvert.DeserializeObject<ODataResponse<LNProject>>(json);

            return result?.Value ?? new List<LNProject>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"GetProjects error: {ex.Message}");
            return new List<LNProject>();
        }
    }

    /// <summary>
    /// Gets warehouses for a given site.
    /// Session: whwmd2500m000
    /// </summary>
    public async Task<List<LNWarehouse>?> GetWarehousesAsync(
        string siteCode,
        string lnEnvironment,
        string company,
        CancellationToken ct = default)
    {
        try
        {
            var baseUrl = $"https://{lnEnvironment}//{company}/oa/OData/";
            var session = "whwmd2500m000";

            // Select specific fields (using LN field names)
            var fields = "?$select=cwar,dsca,site,cdf_mawh,cdf_vrtl";

            // Filter by site code
            var filter = $"&$filter=site eq '{siteCode}'";

            var endpoint = $"{baseUrl}{session}{fields}{filter}";

            var response = await _httpClient.GetAsync(endpoint, ct);

            if (!response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"GetWarehouses failed: {response.StatusCode}");
                return new List<LNWarehouse>();
            }

            var json = await response.Content.ReadAsStringAsync(ct);
            var result = JsonConvert.DeserializeObject<ODataResponse<LNWarehouse>>(json);

            return result?.Value ?? new List<LNWarehouse>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"GetWarehouses error: {ex.Message}");
            return new List<LNWarehouse>();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<List<LocalProject>> GetProjectsAsync(
        IEnumerable<string> projectCodes,
        string engineerId,
        string lnEnvironment,
        string company)
    {
        var codes = projectCodes.Distinct().ToList();
        var filter = string.Join(" or ", codes.Select(code => $"cprj eq '{code}'"));
        var rows = await GetODataListAsync<LNProject>(lnEnvironment, company, "tppdm6100m000", filter);

        return rows.Select(row => new LocalProject
        {
            ProjectId = row.ProjectCode ?? string.Empty,
            Description = row.Description ?? string.Empty,
            AddressCode = row.AddressCode ?? string.Empty,
            SiteCode = row.SiteCode ?? string.Empty,
            EngineerId = engineerId,
            ResponsibilityCode = "SIE"
        }).Where(project => !string.IsNullOrWhiteSpace(project.ProjectId)).ToList();
    }

    public async Task<List<LocalActivity>> GetActivitiesForProjectsAsync(
        IEnumerable<string> projectCodes,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalActivity>();
        foreach (var projectCode in projectCodes.Distinct())
        {
            var rows = await GetODataListAsync<LNActivity>(
                lnEnvironment,
                company,
                "tppss2100m000",
                $"cprj eq '{projectCode}'");

            output.AddRange(rows.Select(row => new LocalActivity
            {
                ActivityId = row.ActivityId ?? string.Empty,
                ProjectId = projectCode,
                Description = row.Description ?? string.Empty,
                ActivityType = row.ActivityType ?? string.Empty,
                CapacityType = row.CapacityType ?? string.Empty,
                Status = row.Status ?? string.Empty,
                IsMultilocation = row.IsMultilocation,
                DprEngineerControl = row.DprEngineerControl
            }).Where(activity => !string.IsNullOrWhiteSpace(activity.ActivityId)));
        }

        return output;
    }

    public async Task<List<LocalLocation>> GetProjectLocationsAsync(
        IEnumerable<string> projectCodes,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalLocation>();
        foreach (var projectCode in projectCodes.Distinct())
        {
            var rows = await GetODataListAsync<LNLocation>(
                lnEnvironment,
                company,
                "tppdm6136m000",
                $"cprj eq '{projectCode}'");

            output.AddRange(rows.Select(row => new LocalLocation
            {
                LocationCode = row.LocationCode ?? string.Empty,
                ProjectId = projectCode,
                Description = row.Description ?? string.Empty,
                WarehouseCode = row.WarehouseCode ?? string.Empty
            }).Where(location => !string.IsNullOrWhiteSpace(location.LocationCode)));
        }

        return output;
    }

    public async Task<List<LocalItem>> GetItemsPurchaseBySiteAsync(
        IEnumerable<string> siteCodes,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalItem>();
        foreach (var siteCode in siteCodes.Where(site => !string.IsNullOrWhiteSpace(site)).Distinct())
        {
            var rows = await GetODataListAsync<LNItem>(
                lnEnvironment,
                company,
                "tdipu0181m000",
                $"site eq '{siteCode}' and citg ne 99 and citg ne 35");

            output.AddRange(rows.Select(row => new LocalItem
            {
                ItemCode = row.ItemCode ?? string.Empty,
                Description = row.Description ?? string.Empty,
                PurchaseUnit = row.PurchaseUnit ?? string.Empty,
                ItemGroup = row.ItemGroup,
                SiteCode = siteCode,
                UoM = row.UoM ?? row.PurchaseUnit ?? string.Empty,
                OnHandQty = row.OnHandQty
            }).Where(item => !string.IsNullOrWhiteSpace(item.ItemCode)));
        }

        return output;
    }

    public async Task<List<LocalBusinessPartner>> GetBusinessPartnersByActivityAsync(
        IEnumerable<LocalActivity> activities,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalBusinessPartner>();
        foreach (var activity in activities.Where(a => !string.IsNullOrWhiteSpace(a.ActivityId)))
        {
            var rows = await GetODataListAsync<LNBusinessPartner>(
                lnEnvironment,
                company,
                "txpss9149m000",
                $"cact eq '{activity.ActivityId}'");

            output.AddRange(rows.Select(row => new LocalBusinessPartner
            {
                BusinessPartnerId = row.BusinessPartnerId ?? string.Empty,
                ActivityId = activity.ActivityId,
                ProjectId = activity.ProjectId,
                Name = row.Name ?? string.Empty,
                SubcontractorPO = row.SubcontractorPO
            }).Where(partner => !string.IsNullOrWhiteSpace(partner.BusinessPartnerId)));
        }

        return output;
    }

    public async Task<List<LocalWarehouse>> GetWarehousesForProjectsAsync(
        IEnumerable<LocalProject> projects,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalWarehouse>();
        foreach (var siteCode in projects.Select(project => project.SiteCode).Where(site => !string.IsNullOrWhiteSpace(site)).Distinct())
        {
            var rows = await GetODataListAsync<LNWarehouse>(
                lnEnvironment,
                company,
                "whwmd2500m000",
                $"site eq '{siteCode}'");

            output.AddRange(rows.Select(row => new LocalWarehouse
            {
                WarehouseCode = row.WarehouseCode ?? string.Empty,
                Description = row.Description ?? string.Empty,
                SiteCode = row.SiteCode ?? siteCode,
                IsMaterialWH = row.IsMaterialWH,
                IsVirtual = row.IsVirtual,
                VirtualWHCode = row.VirtualWHCode ?? string.Empty
            }).Where(warehouse => !string.IsNullOrWhiteSpace(warehouse.WarehouseCode)));
        }

        return output;
    }

    public async Task<List<LocalWarehouseLocation>> GetWarehouseLocationsAsync(
        IEnumerable<LocalWarehouse> warehouses,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalWarehouseLocation>();
        foreach (var warehouseCode in warehouses.Select(w => w.WarehouseCode).Where(code => !string.IsNullOrWhiteSpace(code)).Distinct())
        {
            var rows = await GetODataListAsync<LNWarehouseLocation>(
                lnEnvironment,
                company,
                "whwmd3500m000",
                $"cwar eq '{warehouseCode}'");

            output.AddRange(rows.Select(row => new LocalWarehouseLocation
            {
                LocationCode = string.IsNullOrWhiteSpace(row.LocationCode)
                    ? $"{warehouseCode}-{row.Description}"
                    : row.LocationCode!,
                WarehouseCode = warehouseCode,
                Description = row.Description ?? string.Empty,
                Category = row.Category ?? string.Empty
            }));
        }

        return output;
    }

    public async Task<List<LocalDeliveryPoint>> GetDeliveryPointsAsync(
        IEnumerable<string> addressCodes,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalDeliveryPoint>();
        foreach (var addressCode in addressCodes.Where(code => !string.IsNullOrWhiteSpace(code)).Distinct())
        {
            var rows = await GetODataListAsync<LNDeliveryPoint>(
                lnEnvironment,
                company,
                "tccom4134m000",
                $"cadr eq '{addressCode}'");

            output.AddRange(rows.Select(row => new LocalDeliveryPoint
            {
                DeliveryPointCode = row.DeliveryPointCode ?? string.Empty,
                AddressCode = addressCode,
                Description = row.Description ?? string.Empty
            }).Where(point => !string.IsNullOrWhiteSpace(point.DeliveryPointCode)));
        }

        return output;
    }

    public async Task<List<LocalServiceOrder>> GetReleasedServiceOrdersAsync(
        IEnumerable<string> siteCodes,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalServiceOrder>();
        foreach (var siteCode in siteCodes.Where(site => !string.IsNullOrWhiteSpace(site)).Distinct())
        {
            var rows = await GetODataListAsync<LNServiceOrder>(
                lnEnvironment,
                company,
                "tssoc2100m100",
                $"site eq '{siteCode}' and stat eq 'Released'");

            output.AddRange(rows.Select(row => new LocalServiceOrder
            {
                OrderNo = row.OrderNo ?? string.Empty,
                Status = row.Status ?? string.Empty,
                SiteCode = row.SiteCode ?? siteCode,
                SerialNumber = row.SerialNumber ?? string.Empty,
                Equipment = row.Equipment ?? string.Empty,
                Description = row.Description ?? string.Empty
            }).Where(order => !string.IsNullOrWhiteSpace(order.OrderNo)));
        }

        return output;
    }

    public async Task<List<LocalRentalOrder>> GetReleasedRentalOrdersAsync(
        IEnumerable<string> siteCodes,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalRentalOrder>();
        foreach (var siteCode in siteCodes.Where(site => !string.IsNullOrWhiteSpace(site)).Distinct())
        {
            var rows = await GetODataListAsync<LNServiceOrder>(
                lnEnvironment,
                company,
                "tssoc2600m300",
                $"site eq '{siteCode}' and stat eq 'Released'");

            output.AddRange(rows.Select(row => new LocalRentalOrder
            {
                OrderNo = row.OrderNo ?? string.Empty,
                Status = row.Status ?? string.Empty,
                SiteCode = row.SiteCode ?? siteCode,
                ProjectCode = row.SiteCode ?? siteCode,
                SerialNumber = row.SerialNumber ?? string.Empty,
                Equipment = row.Equipment ?? string.Empty,
                Description = row.Description ?? string.Empty
            }).Where(order => !string.IsNullOrWhiteSpace(order.OrderNo)));
        }

        return output;
    }

    public async Task<List<LocalItem>> GetInventory360Async(
        IEnumerable<LocalItem> items,
        string lnEnvironment,
        string company)
    {
        var output = new List<LocalItem>();
        foreach (var item in items.Where(i => !string.IsNullOrWhiteSpace(i.ItemCode)))
        {
            var rows = await GetODataListAsync<LNInventory>(
                lnEnvironment,
                company,
                "whwmd4300m000",
                $"item eq '{item.ItemCode}' and site eq '{item.SiteCode}'");
            var inventory = rows.FirstOrDefault();

            item.OnHandQty = inventory?.OnHandQty ?? item.OnHandQty;
            item.UoM = inventory?.UoM ?? item.UoM;
            output.Add(item);
        }

        return output;
    }

    /// <summary>Clears the stored JWT token on logout.</summary>
    public void ClearToken()
    {
        _jwtToken = null;
        _httpClient.DefaultRequestHeaders.Authorization = null;
    }

    /// <summary>Computes SHA256 hash of a string (for PIN storage).</summary>
    public static string ComputeSHA256Hash(string input)
    {
        using var sha = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(input);
        var hashBytes = sha.ComputeHash(bytes);
        return Convert.ToHexString(hashBytes).ToLower();
    }

    private async Task<List<T>> GetODataListAsync<T>(
        string lnEnvironment,
        string company,
        string session,
        string? filter = null,
        CancellationToken ct = default)
    {
        try
        {
            var baseUrl = $"https://{lnEnvironment}/{company}/oa/OData/";
            var endpoint = $"{baseUrl}{session}";
            if (!string.IsNullOrWhiteSpace(filter))
            {
                endpoint += $"?$filter={Uri.EscapeDataString(filter)}";
            }

            var response = await _httpClient.GetAsync(endpoint, ct);
            if (!response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"{session} failed: {response.StatusCode}");
                return new List<T>();
            }

            var json = await response.Content.ReadAsStringAsync(ct);
            return JsonConvert.DeserializeObject<ODataResponse<T>>(json)?.Value ?? new List<T>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"{session} error: {ex.Message}");
            return new List<T>();
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs for LN OData Responses
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>Generic OData response wrapper.</summary>
public class ODataResponse<T>
{
    [JsonProperty("value")]
    public List<T>? Value { get; set; }

    [JsonProperty("@odata.count")]
    public int? Count { get; set; }
}

/// <summary>LN Auth response containing JWT token.</summary>
public class LNAuthResponse
{
    [JsonProperty("token")]
    public string? Token { get; set; }

    [JsonProperty("expiresIn")]
    public int? ExpiresIn { get; set; }
}

/// <summary>
/// LN Responsibility data (Employee → Project mapping).
/// Session: tppdm6149m000
/// </summary>
public class LNResponsibility
{
    [JsonProperty("cprj")]
    public string? ProjectCode { get; set; }

    [JsonProperty("cres")]
    public string? ResponsibilityCode { get; set; } // SIE or SER

    [JsonProperty("emno")]
    public string? EmployeeCode { get; set; }

    [JsonProperty("vldt")]
    public DateTime? ValidTo { get; set; }
}

/// <summary>
/// LN Project data.
/// Session: tppdm6100m000
/// </summary>
public class LNProject
{
    [JsonProperty("cprj")]
    public string? ProjectCode { get; set; }

    [JsonProperty("dsca")]
    public string? Description { get; set; }

    [JsonProperty("padr")]
    public string? AddressCode { get; set; }

    [JsonProperty("site")]
    public string? SiteCode { get; set; }
}

/// <summary>
/// LN Warehouse data.
/// Session: whwmd2500m000
/// </summary>
public class LNWarehouse
{
    [JsonProperty("cwar")]
    public string? WarehouseCode { get; set; }

    [JsonProperty("dsca")]
    public string? Description { get; set; }

    [JsonProperty("site")]
    public string? SiteCode { get; set; }

    [JsonProperty("cdf_mawh")]
    public bool IsMaterialWH { get; set; }

    [JsonProperty("cdf_vrtl")]
    public bool IsVirtual { get; set; }

    [JsonProperty("cdf_vrwh")]
    public string? VirtualWHCode { get; set; }
}

public class LNActivity
{
    [JsonProperty("cact")]
    public string? ActivityId { get; set; }

    [JsonProperty("dsca")]
    public string? Description { get; set; }

    [JsonProperty("catp")]
    public string? ActivityType { get; set; }

    [JsonProperty("cctp")]
    public string? CapacityType { get; set; }

    [JsonProperty("stat")]
    public string? Status { get; set; }

    [JsonProperty("mloc")]
    public bool IsMultilocation { get; set; }

    [JsonProperty("cdf_dpec")]
    public bool DprEngineerControl { get; set; }
}

public class LNLocation
{
    [JsonProperty("cloc")]
    public string? LocationCode { get; set; }

    [JsonProperty("dsca")]
    public string? Description { get; set; }

    [JsonProperty("cwar")]
    public string? WarehouseCode { get; set; }
}

public class LNItem
{
    [JsonProperty("item")]
    public string? ItemCode { get; set; }

    [JsonProperty("dsca")]
    public string? Description { get; set; }

    [JsonProperty("cuqp")]
    public string? PurchaseUnit { get; set; }

    [JsonProperty("citg")]
    public int ItemGroup { get; set; }

    [JsonProperty("cuni")]
    public string? UoM { get; set; }

    [JsonProperty("qoh")]
    public decimal OnHandQty { get; set; }
}

public class LNBusinessPartner
{
    [JsonProperty("bpid")]
    public string? BusinessPartnerId { get; set; }

    [JsonProperty("nama")]
    public string? Name { get; set; }

    [JsonProperty("subc")]
    public bool SubcontractorPO { get; set; }
}

public class LNWarehouseLocation
{
    [JsonProperty("loca")]
    public string? LocationCode { get; set; }

    [JsonProperty("dsca")]
    public string? Description { get; set; }

    [JsonProperty("catg")]
    public string? Category { get; set; }
}

public class LNDeliveryPoint
{
    [JsonProperty("dlpt")]
    public string? DeliveryPointCode { get; set; }

    [JsonProperty("dsca")]
    public string? Description { get; set; }
}

public class LNServiceOrder
{
    [JsonProperty("orno")]
    public string? OrderNo { get; set; }

    [JsonProperty("stat")]
    public string? Status { get; set; }

    [JsonProperty("site")]
    public string? SiteCode { get; set; }

    [JsonProperty("sern")]
    public string? SerialNumber { get; set; }

    [JsonProperty("item")]
    public string? Equipment { get; set; }

    [JsonProperty("dsca")]
    public string? Description { get; set; }
}

public class LNInventory
{
    [JsonProperty("qoh")]
    public decimal OnHandQty { get; set; }

    [JsonProperty("cuni")]
    public string? UoM { get; set; }
}
