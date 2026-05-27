using IndentMate.Mobile.Data;

namespace IndentMate.Mobile.Services;

/// <summary>
/// Pulls all required LN master-data sessions into local SQLite.
/// </summary>
public class SyncService
{
    private const int TotalSessions = 12;
    private readonly DatabaseService _databaseService;
    private readonly LNApiService _lnApiService;

    public event EventHandler<SyncProgressEventArgs>? SyncProgressChanged;

    public SyncService(DatabaseService databaseService, LNApiService lnApiService)
    {
        _databaseService = databaseService;
        _lnApiService = lnApiService;
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

    private void RaiseProgress(int completed)
    {
        SyncProgressChanged?.Invoke(this, new SyncProgressEventArgs(completed, TotalSessions));
    }
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
