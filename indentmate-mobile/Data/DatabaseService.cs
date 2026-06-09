using SQLite;

namespace IndentMate.Mobile.Data;

/// <summary>
/// Primary SQLite database service for IndentMate mobile app.
/// Provides async CRUD operations for all local tables.
/// Uses a single shared connection (thread-safe SQLiteAsyncConnection).
/// </summary>
public class DatabaseService
{
    private SQLiteAsyncConnection? _db;
    private readonly string _dbPath;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private bool _initialized = false;

    public DatabaseService(string dbPath)
    {
        _dbPath = dbPath;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Creates all SQLite tables if they don't exist.
    /// Called once at app startup via MauiProgram DI.
    /// Thread-safe: uses SemaphoreSlim to prevent double-init.
    /// </summary>
    public async Task InitAsync()
    {
        await _initLock.WaitAsync();
        try
        {
            if (_initialized) return;

            _db = new SQLiteAsyncConnection(
                _dbPath,
                SQLiteOpenFlags.ReadWrite | SQLiteOpenFlags.Create | SQLiteOpenFlags.SharedCache);

            await _db.CreateTableAsync<LocalEngineer>();
            await _db.CreateTableAsync<LocalProject>();
            await _db.CreateTableAsync<LocalActivity>();
            await _db.CreateTableAsync<LocalLocation>();
            await _db.CreateTableAsync<LocalBusinessPartner>();
            await _db.CreateTableAsync<LocalIndent>();
            await _db.CreateTableAsync<LocalIndentItem>();
            await _db.CreateTableAsync<LocalWarehouse>();
            await _db.CreateTableAsync<LocalWarehouseLocation>();
            await _db.CreateTableAsync<LocalDeliveryPoint>();
            await _db.CreateTableAsync<LocalItem>();
            await _db.CreateTableAsync<LocalServiceOrder>();
            await _db.CreateTableAsync<LocalRentalOrder>();
            await _db.CreateTableAsync<SyncLog>();
            await _db.CreateTableAsync<LocalOfflineQueue>();
            await EnsureLocalIndentSyncColumnsAsync(_db);
            await EnsureLocalBusinessPartnerColumnsAsync(_db);

            _initialized = true;
        }
        finally
        {
            _initLock.Release();
        }
    }

    private async Task<SQLiteAsyncConnection> GetDbAsync()
    {
        if (!_initialized) await InitAsync();
        return _db!;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Generic CRUD
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Returns all rows for type T.</summary>
    public async Task<List<T>> GetAllAsync<T>() where T : new()
    {
        var db = await GetDbAsync();
        return await db.Table<T>().ToListAsync();
    }

    /// <summary>
    /// Inserts or replaces an item (upsert).
    /// Uses InsertOrReplace so master data syncs work as idempotent upserts.
    /// </summary>
    public async Task<int> SaveAsync<T>(T item) where T : new()
    {
        var db = await GetDbAsync();
        return await db.InsertOrReplaceAsync(item);
    }

    /// <summary>Deletes the given item by PK.</summary>
    public async Task<int> DeleteAsync<T>(T item) where T : new()
    {
        var db = await GetDbAsync();
        return await db.DeleteAsync(item);
    }

    /// <summary>Inserts a batch of items in a single transaction (fast upsert for sync).</summary>
    public async Task SaveBatchAsync<T>(IEnumerable<T> items) where T : new()
    {
        var db = await GetDbAsync();
        await db.RunInTransactionAsync(conn =>
        {
            foreach (var item in items)
                conn.InsertOrReplace(item);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Indent-specific queries
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Returns a single indent by its GUID primary key.</summary>
    public async Task<LocalIndent?> GetIndentByIdAsync(string indentId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalIndent>()
            .Where(i => i.IndentId == indentId)
            .FirstOrDefaultAsync();
    }

    /// <summary>All indents for an engineer, newest first.</summary>
    public async Task<List<LocalIndent>> GetIndentsForEngineerAsync(string engineerId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalIndent>()
            .Where(i => i.EngineerId == engineerId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();
    }

    /// <summary>Indents by status (e.g. "Created", "PendingApproval").</summary>
    public async Task<List<LocalIndent>> GetIndentsByStatusAsync(string engineerId, string status)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalIndent>()
            .Where(i => i.EngineerId == engineerId && i.Status == status)
            .ToListAsync();
    }

    public async Task<List<LocalIndent>> GetPendingSyncIndentsAsync()
    {
        var db = await GetDbAsync();
        return await db.Table<LocalIndent>()
            .Where(i => i.Status == "PendingSync" && !i.IsSynced)
            .OrderBy(i => i.SubmittedAt)
            .ToListAsync();
    }

    /// <summary>Count by status — used for Home dashboard stat cards.</summary>
    public async Task<int> CountIndentsByStatusAsync(string engineerId, string status)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalIndent>()
            .Where(i => i.EngineerId == engineerId && i.Status == status)
            .CountAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IndentItem queries
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>All line items for a given indent.</summary>
    public async Task<List<LocalIndentItem>> GetItemsForIndentAsync(string indentId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalIndentItem>()
            .Where(i => i.IndentId == indentId)
            .ToListAsync();
    }

    public async Task UpdateIndentAsync(LocalIndent indent)
    {
        var db = await GetDbAsync();
        await db.UpdateAsync(indent);
    }

    public async Task MarkIndentPendingSyncAsync(string indentId)
    {
        var db = await GetDbAsync();
        var indent = await GetIndentByIdAsync(indentId);
        if (indent is null) return;

        indent.Status = "PendingSync";
        indent.SubmittedAt ??= DateTime.UtcNow;
        indent.IsSynced = false;
        indent.SyncErrorMessage = string.Empty;
        await db.UpdateAsync(indent);
    }

    public async Task MarkIndentSyncedAsync(string indentId, string officialIndentNo)
    {
        var db = await GetDbAsync();
        var indent = await GetIndentByIdAsync(indentId);
        if (indent is null) return;

        indent.OfficialIndentNo = officialIndentNo;
        indent.Status = "Created";
        indent.IsSynced = true;
        indent.SyncErrorMessage = string.Empty;
        await db.UpdateAsync(indent);
    }

    public async Task MarkIndentSyncErrorAsync(string indentId, string errorMessage)
    {
        var db = await GetDbAsync();
        var indent = await GetIndentByIdAsync(indentId);
        if (indent is null) return;

        indent.Status = "SyncError";
        indent.IsSynced = false;
        indent.SyncErrorMessage = errorMessage;
        await db.UpdateAsync(indent);
    }

    public async Task<int> CountItemsForIndentAsync(string indentId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalIndentItem>()
            .Where(i => i.IndentId == indentId)
            .CountAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Master data queries
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Projects assigned to engineer.</summary>
    public async Task<List<LocalProject>> GetProjectsForEngineerAsync(string engineerId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalProject>()
            .Where(p => p.EngineerId == engineerId)
            .ToListAsync();
    }

    public async Task<List<LocalProject>> GetSieProjectsForEngineerAsync(string engineerId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalProject>()
            .Where(p => p.EngineerId == engineerId && p.ResponsibilityCode == "SIE")
            .ToListAsync();
    }

    public async Task<List<LocalProject>> GetSerProjectsForEngineerAsync(string engineerId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalProject>()
            .Where(p => p.EngineerId == engineerId && p.ResponsibilityCode == "SER")
            .ToListAsync();
    }

    /// <summary>
    /// Warehouses for a site — filtered to Material WH only.
    /// Virtual warehouse auto-fill logic applied by caller.
    /// </summary>
    public async Task<List<LocalWarehouse>> GetWarehousesForSiteAsync(string siteCode)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalWarehouse>()
            .Where(w => w.SiteCode == siteCode && w.IsMaterialWH)
            .ToListAsync();
    }

    public async Task<List<LocalWarehouseLocation>> GetWarehouseLocationsAsync(string warehouseCode)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalWarehouseLocation>()
            .Where(l => l.WarehouseCode == warehouseCode)
            .ToListAsync();
    }

    public async Task<List<LocalBusinessPartner>> GetSubcontractorsForProjectAsync(string projectId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalBusinessPartner>()
            .Where(p => p.ProjectId == projectId && p.SubcontractorPO)
            .ToListAsync();
    }

    public async Task<List<LocalBusinessPartner>> GetSubcontractorsForProjectLocationAsync(
        string projectId,
        string locationCode)
    {
        var db = await GetDbAsync();
        var partners = await db.Table<LocalBusinessPartner>()
            .Where(p => p.ProjectId == projectId &&
                        p.LocationCode == locationCode &&
                        p.SubcontractorPO)
            .ToListAsync();

        if (partners.Count != 0)
            return partners;

        return await db.Table<LocalBusinessPartner>()
            .Where(p => p.ProjectId == projectId &&
                        p.SubcontractorPO &&
                        (p.LocationCode == null || p.LocationCode == ""))
            .ToListAsync();
    }

    /// <summary>
    /// Items for a site — excludes ItemGroup 99 (Group 99) and 35 per business rules.
    /// </summary>
    public async Task<List<LocalItem>> GetItemsForSiteAsync(string siteCode)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalItem>()
            .Where(i => i.SiteCode == siteCode && i.ItemGroup != 99 && i.ItemGroup != 35)
            .ToListAsync();
    }

    public async Task<LocalWarehouse?> GetWarehouseAsync(string warehouseCode)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalWarehouse>()
            .Where(w => w.WarehouseCode == warehouseCode)
            .FirstOrDefaultAsync();
    }

    public async Task<LocalProject?> GetProjectAsync(string projectId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalProject>()
            .Where(p => p.ProjectId == projectId)
            .FirstOrDefaultAsync();
    }

    public async Task<List<LocalLocation>> GetLocationsForProjectAsync(string projectId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalLocation>()
            .Where(l => l.ProjectId == projectId)
            .ToListAsync();
    }

    public async Task<List<LocalActivity>> GetActivitiesForProjectAsync(string projectId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalActivity>()
            .Where(a => a.ProjectId == projectId)
            .ToListAsync();
    }

    public async Task<List<LocalServiceOrder>> GetReleasedServiceOrdersForSiteAsync(string siteCode)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalServiceOrder>()
            .Where(o => o.SiteCode == siteCode && o.Status == "Released")
            .ToListAsync();
    }

    public async Task<List<LocalRentalOrder>> GetReleasedRentalOrdersForProjectAsync(string projectCode)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalRentalOrder>()
            .Where(o => (o.ProjectCode == projectCode || o.SiteCode == projectCode) && o.Status == "Released")
            .ToListAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Engineer
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Load engineer by ID — used during login PIN validation.</summary>
    public async Task<LocalEngineer?> GetEngineerAsync(string engineerId)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalEngineer>()
            .Where(e => e.EngineerId == engineerId)
            .FirstOrDefaultAsync();
    }

    public async Task<List<LocalEngineer>> GetRecentEngineersAsync(int limit = 5)
    {
        var db = await GetDbAsync();
        return await db.Table<LocalEngineer>()
            .OrderByDescending(e => e.LastSyncAt)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<int> DeleteEngineerAsync(string engineerId)
    {
        var db = await GetDbAsync();
        var engineer = await db.Table<LocalEngineer>()
            .Where(e => e.EngineerId == engineerId)
            .FirstOrDefaultAsync();

        if (engineer is null) return 0;

        return await db.DeleteAsync(engineer);
    }

    public async Task UpdateEngineerLastSyncAsync(string engineerId, DateTime lastSyncAt)
    {
        var db = await GetDbAsync();
        var engineer = await db.Table<LocalEngineer>()
            .Where(e => e.EngineerId == engineerId)
            .FirstOrDefaultAsync();

        if (engineer is null) return;

        engineer.LastSyncAt = lastSyncAt;
        await db.UpdateAsync(engineer);
    }

    public async Task SaveSyncLogAsync(string engineerId, string sessionCode, string status, string errorMessage = "")
    {
        var db = await GetDbAsync();
        await db.InsertAsync(new SyncLog
        {
            EngineerId = engineerId,
            SessionCode = sessionCode,
            Status = status,
            Timestamp = DateTime.UtcNow,
            ErrorMessage = errorMessage
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Offline Queue
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>All unsynced items in the offline queue.</summary>
    public async Task<List<LocalOfflineQueue>> GetPendingOfflineQueueAsync()
    {
        var db = await GetDbAsync();
        return await db.Table<LocalOfflineQueue>()
            .Where(q => q.SyncedAt == null)
            .OrderBy(q => q.CreatedAt)
            .ToListAsync();
    }

    public async Task MarkQueueItemSyncedAsync(string queueId)
    {
        var db = await GetDbAsync();
        var item = await db.Table<LocalOfflineQueue>()
            .Where(q => q.QueueId == queueId)
            .FirstOrDefaultAsync();
        if (item is not null)
        {
            item.SyncedAt = DateTime.UtcNow;
            await db.UpdateAsync(item);
        }
    }

    public async Task IncrementQueueRetryAsync(string queueId)
    {
        var db = await GetDbAsync();
        var item = await db.Table<LocalOfflineQueue>()
            .Where(q => q.QueueId == queueId)
            .FirstOrDefaultAsync();
        if (item is not null)
        {
            item.RetryCount++;
            await db.UpdateAsync(item);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Utility
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Drops and recreates all tables — used during full resync.</summary>
    private static async Task EnsureLocalIndentSyncColumnsAsync(SQLiteAsyncConnection db)
    {
        await AddColumnIfMissingAsync(db, "LocalIndents", "OfficialIndentNo", "TEXT NOT NULL DEFAULT ''");
        await AddColumnIfMissingAsync(db, "LocalIndents", "SyncErrorMessage", "TEXT NOT NULL DEFAULT ''");
    }

    private static async Task EnsureLocalBusinessPartnerColumnsAsync(SQLiteAsyncConnection db)
    {
        await AddColumnIfMissingAsync(db, "LocalBusinessPartners", "LocationCode", "TEXT NOT NULL DEFAULT ''");
    }

    private static async Task AddColumnIfMissingAsync(
        SQLiteAsyncConnection db,
        string tableName,
        string columnName,
        string columnDefinition)
    {
        var columns = await db.QueryAsync<TableColumnInfo>($"PRAGMA table_info({tableName})");
        if (columns.Any(column => string.Equals(column.Name, columnName, StringComparison.OrdinalIgnoreCase)))
            return;

        await db.ExecuteAsync($"ALTER TABLE {tableName} ADD COLUMN {columnName} {columnDefinition}");
    }

    private sealed class TableColumnInfo
    {
        [Column("name")]
        public string Name { get; set; } = string.Empty;
    }

    public async Task ResetDatabaseAsync()
    {
        var db = await GetDbAsync();
        await db.DropTableAsync<LocalEngineer>();
        await db.DropTableAsync<LocalProject>();
        await db.DropTableAsync<LocalActivity>();
        await db.DropTableAsync<LocalLocation>();
        await db.DropTableAsync<LocalBusinessPartner>();
        await db.DropTableAsync<LocalIndent>();
        await db.DropTableAsync<LocalIndentItem>();
        await db.DropTableAsync<LocalWarehouse>();
        await db.DropTableAsync<LocalWarehouseLocation>();
        await db.DropTableAsync<LocalDeliveryPoint>();
        await db.DropTableAsync<LocalItem>();
        await db.DropTableAsync<LocalServiceOrder>();
        await db.DropTableAsync<LocalRentalOrder>();
        await db.DropTableAsync<SyncLog>();
        await db.DropTableAsync<LocalOfflineQueue>();
        _initialized = false;
        await InitAsync();
    }
}
