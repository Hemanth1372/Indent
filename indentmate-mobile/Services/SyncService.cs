using IndentMate.Mobile.Data;
using Newtonsoft.Json;
using System.Net;

namespace IndentMate.Mobile.Services;

/// <summary>
/// Pulls all required LN master-data sessions into local SQLite.
/// </summary>
public class SyncService
{
    private const int TotalSessions = 12;
    private readonly DatabaseService _databaseService;
    private readonly ApiService _apiService;
    private readonly LNApiService _lnApiService;
    private readonly SemaphoreSlim _pushLock = new(1, 1);

    public event EventHandler<SyncProgressEventArgs>? SyncProgressChanged;

    public SyncService(DatabaseService databaseService, ApiService apiService, LNApiService lnApiService)
    {
        _databaseService = databaseService;
        _apiService = apiService;
        _lnApiService = lnApiService;
        Connectivity.Current.ConnectivityChanged += HandleConnectivityChanged;
    }

    public async Task PushPendingIndentsAsync(CancellationToken ct = default)
    {
        var access = Connectivity.Current.NetworkAccess;
        if (access != NetworkAccess.Internet && access != NetworkAccess.ConstrainedInternet)
            return;

        if (!await _pushLock.WaitAsync(0, ct))
            return;

        try
        {
            var pendingIndents = await _databaseService.GetPendingSyncIndentsAsync();

            foreach (var indent in pendingIndents)
            {
                ct.ThrowIfCancellationRequested();
                await PushIndentAsync(indent, ct);
            }
        }
        finally
        {
            _pushLock.Release();
        }
    }

    public async Task FullSyncAsync(string engineerId)
    {
        var lnEnvironment = await SecureStorage.Default.GetAsync("ln_environment") ?? "TST";
        var company = await SecureStorage.Default.GetAsync("company") ?? string.Empty;

        if (string.IsNullOrWhiteSpace(engineerId))
            throw new InvalidOperationException("Engineer ID is required for sync.");

        if (string.IsNullOrWhiteSpace(company))
            throw new InvalidOperationException("Company is required for sync.");

        var completed = 0;

        var responsibilities = await RunSessionAsync(
            engineerId,
            "tppdm6149m000",
            ++completed,
            () => _lnApiService.GetResponsibilitiesByEmployeeAsync(engineerId, lnEnvironment, company));

        var validResponsibilities = (responsibilities ?? new List<LNResponsibility>())
            .Where(r => r.ResponsibilityCode is "SIE" or "SER")
            .ToList();

        if (validResponsibilities.Count == 0)
            throw new InvalidOperationException("No valid SIE/SER responsibilities found for this engineer.");

        var projectCodes = validResponsibilities
            .Select(r => r.ProjectCode)
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code!)
            .Distinct()
            .ToList();

        var engineer = await _databaseService.GetEngineerAsync(engineerId) ?? new LocalEngineer
        {
            EngineerId = engineerId,
            Name = engineerId,
            Company = company,
            LNEnvironment = lnEnvironment
        };
        engineer.ResponsibilityCode = validResponsibilities.First().ResponsibilityCode ?? string.Empty;
        engineer.ValidTo = validResponsibilities.Where(r => r.ValidTo.HasValue).MaxBy(r => r.ValidTo)?.ValidTo;
        await _databaseService.SaveAsync(engineer);

        var projects = await RunSessionAsync(
            engineerId,
            "tppdm6100m000",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetProjectsAsync(projectCodes, engineerId, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        var activities = await RunSessionAsync(
            engineerId,
            "tppss2100m000",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetActivitiesForProjectsAsync(projectCodes, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        await RunSessionAsync(
            engineerId,
            "tppdm6136m000",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetProjectLocationsAsync(projectCodes, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        var siteCodes = projects
            .Select(project => project.SiteCode)
            .Where(site => !string.IsNullOrWhiteSpace(site))
            .Distinct()
            .ToList();

        var items = await RunSessionAsync(
            engineerId,
            "tdipu0181m000",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetItemsPurchaseBySiteAsync(siteCodes, lnEnvironment, company);
                rows = rows.Where(item => item.ItemGroup != 99 && item.ItemGroup != 35).ToList();
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        await RunSessionAsync(
            engineerId,
            "txpss9149m000",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetBusinessPartnersByActivityAsync(activities, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        var warehouses = await RunSessionAsync(
            engineerId,
            "whwmd2500m000",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetWarehousesForProjectsAsync(projects, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        await RunSessionAsync(
            engineerId,
            "whwmd3500m000",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetWarehouseLocationsAsync(warehouses, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        await RunSessionAsync(
            engineerId,
            "tccom4134m000",
            ++completed,
            async () =>
            {
                var addressCodes = projects
                    .Select(project => project.AddressCode)
                    .Where(code => !string.IsNullOrWhiteSpace(code))
                    .Distinct();
                var rows = await _lnApiService.GetDeliveryPointsAsync(addressCodes, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        await RunSessionAsync(
            engineerId,
            "tssoc2100m100",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetReleasedServiceOrdersAsync(siteCodes, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        await RunSessionAsync(
            engineerId,
            "tssoc2600m300",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetReleasedRentalOrdersAsync(siteCodes, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        await RunSessionAsync(
            engineerId,
            "whwmd4300m000",
            ++completed,
            async () =>
            {
                var rows = await _lnApiService.GetInventory360Async(items, lnEnvironment, company);
                await _databaseService.SaveBatchAsync(rows);
                return rows;
            });

        await _databaseService.UpdateEngineerLastSyncAsync(engineerId, DateTime.UtcNow);
    }

    public async Task<bool> IsSyncRequiredAsync()
    {
        var engineerId = await SecureStorage.Default.GetAsync("engineer_id");
        if (string.IsNullOrWhiteSpace(engineerId))
            return true;

        return await IsSyncRequiredAsync(engineerId);
    }

    public async Task<bool> IsSyncRequiredAsync(string engineerId)
    {
        var engineer = await _databaseService.GetEngineerAsync(engineerId);
        return engineer?.LastSyncAt is null ||
               DateTime.UtcNow - engineer.LastSyncAt.Value > TimeSpan.FromHours(24);
    }

    private async Task<T> RunSessionAsync<T>(
        string engineerId,
        string sessionCode,
        int completed,
        Func<Task<T>> action)
    {
        try
        {
            var result = await action();
            await _databaseService.SaveSyncLogAsync(engineerId, sessionCode, "Success");
            RaiseProgress(completed);
            return result;
        }
        catch (Exception ex)
        {
            await _databaseService.SaveSyncLogAsync(engineerId, sessionCode, "Failed", ex.Message);
            RaiseProgress(completed);
            throw;
        }
    }

    private async Task PushIndentAsync(LocalIndent indent, CancellationToken ct)
    {
        var items = await _databaseService.GetItemsForIndentAsync(indent.IndentId);
        var payload = BuildIndentPayload(indent, items);

        try
        {
            var result = await _apiService.PostForResultAsync<IndentSyncPayload, IndentSyncResponse>(
                "/api/indents",
                payload,
                ct);

            if (result.IsSuccessStatusCode && !string.IsNullOrWhiteSpace(result.Data?.IndentNo))
            {
                await _databaseService.MarkIndentSyncedAsync(indent.IndentId, result.Data.IndentNo);
                return;
            }

            // All non-success responses — mark with server's error message
            if (!result.IsSuccessStatusCode)
            {
                var errorMsg = ExtractErrorMessage(result.RawBody);
                if (string.IsNullOrWhiteSpace(errorMsg))
                {
                    errorMsg = result.StatusCode == System.Net.HttpStatusCode.Unauthorized
                        ? "Session expired. Please log out and log in again."
                        : $"Server returned {(int)result.StatusCode}.";
                }
                await _databaseService.MarkIndentSyncErrorAsync(indent.IndentId, errorMsg);
            }
        }
        catch (HttpRequestException)
        {
            await _databaseService.MarkIndentPendingSyncAsync(indent.IndentId);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            await _databaseService.MarkIndentPendingSyncAsync(indent.IndentId);
        }
    }

    private static IndentSyncPayload BuildIndentPayload(LocalIndent indent, List<LocalIndentItem> items)
    {
        var firstItem = items.FirstOrDefault();

        // Pick the first non-empty delivery location across item, header, warehouse, project
        var deliveryLocation = new[]
        {
            firstItem?.LocationId,
            indent.FromLocationId,
            indent.WarehouseId,
            indent.ProjectId
        }.FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)) ?? string.Empty;

        var requirementType = string.IsNullOrWhiteSpace(indent.IndentType) ? "Issue" : indent.IndentType;

        return new IndentSyncPayload
        {
            AppRequestId = indent.RequestNo,
            ProjectCode = indent.ProjectId,
            SourceWarehouse = indent.WarehouseId,
            DeliveryLocation = deliveryLocation,
            RequirementType = requirementType,
            IndentType = requirementType,
            EngineerId = indent.EngineerId,
            EngineerType = indent.EngineerType,
            OrderNo = indent.OrderNo,
            OrderType = indent.OrderType,
            ToEntityId = string.IsNullOrWhiteSpace(indent.ToContractorId) ? indent.OrderNo : indent.ToContractorId,
            EquipmentDisplay = indent.EquipmentDisplay,
            Status = "Created",
            Items = items.Select(item => new IndentSyncLinePayload
            {
                ItemCode = item.MaterialCode,
                MaterialCode = item.MaterialCode,
                MaterialDesc = item.MaterialDesc,
                Make = indent.EquipmentDisplay,
                WorkType = item.WorkType,
                ActivityId = item.ActivityId,
                LocationId = item.LocationId,
                Uom = item.UoM,
                RequiredQty = item.RequestedQty,
                RequestedQty = item.RequestedQty,
                ToBusinessPartner = item.BusinessPartnerId,
                Remarks = item.Remarks,
                AttachmentUrl = item.AttachmentUrl
            }).ToList()
        };
    }

    private static string ExtractErrorMessage(string responseBody)
    {
        if (string.IsNullOrWhiteSpace(responseBody))
            return "Validation failed while syncing indent.";

        try
        {
            var error = JsonConvert.DeserializeObject<ApiErrorResponse>(responseBody);
            return error?.Message ?? responseBody;
        }
        catch (JsonException)
        {
            return responseBody;
        }
    }

    private void RaiseProgress(int completed)
    {
        SyncProgressChanged?.Invoke(this, new SyncProgressEventArgs(completed, TotalSessions));
    }

    private async void HandleConnectivityChanged(object? sender, ConnectivityChangedEventArgs e)
    {
        if (e.NetworkAccess != NetworkAccess.Internet && e.NetworkAccess != NetworkAccess.ConstrainedInternet)
            return;

        try
        {
            await PushPendingIndentsAsync();
        }
        catch
        {
            // PendingSync records remain queued and will retry on the next connectivity change.
        }
    }
}

public sealed class IndentSyncPayload
{
    [JsonProperty("app_request_id")]
    public string AppRequestId { get; set; } = string.Empty;

    [JsonProperty("project_code")]
    public string ProjectCode { get; set; } = string.Empty;

    [JsonProperty("source_warehouse")]
    public string SourceWarehouse { get; set; } = string.Empty;

    [JsonProperty("delivery_location")]
    public string DeliveryLocation { get; set; } = string.Empty;

    [JsonProperty("requirement_type")]
    public string RequirementType { get; set; } = string.Empty;

    [JsonProperty("indent_type")]
    public string IndentType { get; set; } = string.Empty;

    [JsonProperty("engineerId")]
    public string EngineerId { get; set; } = string.Empty;

    [JsonProperty("engineerType")]
    public string EngineerType { get; set; } = string.Empty;

    [JsonProperty("orderNo")]
    public string OrderNo { get; set; } = string.Empty;

    [JsonProperty("orderType")]
    public string OrderType { get; set; } = string.Empty;

    [JsonProperty("to_entity_id")]
    public string ToEntityId { get; set; } = string.Empty;

    [JsonProperty("equipmentDisplay")]
    public string EquipmentDisplay { get; set; } = string.Empty;

    [JsonProperty("status")]
    public string Status { get; set; } = string.Empty;

    [JsonProperty("items")]
    public List<IndentSyncLinePayload> Items { get; set; } = new();
}

public sealed class IndentSyncLinePayload
{
    [JsonProperty("item_code")]
    public string ItemCode { get; set; } = string.Empty;

    [JsonProperty("materialCode")]
    public string MaterialCode { get; set; } = string.Empty;

    [JsonProperty("materialDesc")]
    public string MaterialDesc { get; set; } = string.Empty;

    [JsonProperty("make")]
    public string Make { get; set; } = string.Empty;

    [JsonProperty("workType")]
    public string WorkType { get; set; } = string.Empty;

    [JsonProperty("activityId")]
    public string ActivityId { get; set; } = string.Empty;

    [JsonProperty("locationId")]
    public string LocationId { get; set; } = string.Empty;

    [JsonProperty("uom")]
    public string Uom { get; set; } = string.Empty;

    [JsonProperty("required_qty")]
    public decimal RequiredQty { get; set; }

    [JsonProperty("requestedQty")]
    public decimal RequestedQty { get; set; }

    [JsonProperty("toBusinessPartner")]
    public string ToBusinessPartner { get; set; } = string.Empty;

    [JsonProperty("remarks")]
    public string Remarks { get; set; } = string.Empty;

    [JsonProperty("attachmentUrl")]
    public string AttachmentUrl { get; set; } = string.Empty;
}

public sealed class IndentSyncResponse
{
    [JsonProperty("app_request_id")]
    public string AppRequestId { get; set; } = string.Empty;

    [JsonProperty("indent_no")]
    public string IndentNo { get; set; } = string.Empty;
}

public sealed class ApiErrorResponse
{
    [JsonProperty("message")]
    public string? Message { get; set; }
}

public class SyncProgressEventArgs : EventArgs
{
    public int Completed { get; }
    public int Total { get; }
    public string Message => $"Syncing {Completed}/{Total}...";
    public int Percent => Total == 0 ? 0 : (int)Math.Round(Completed * 100d / Total);

    public SyncProgressEventArgs(int completed, int total)
    {
        Completed = completed;
        Total = total;
    }
}
