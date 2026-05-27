using IndentMate.Shared.Models;
using SQLite;

namespace IndentMate.Mobile.Data;

/// <summary>
/// SQLite database context for IndentMate offline storage.
/// Manages all local tables: Engineers, Projects, Indents, IndentItems,
/// Warehouses, Locations, Activities, Items, ServiceOrders, SyncLog, OfflineQueue.
/// </summary>
public class AppDatabase
{
    private SQLiteAsyncConnection? _db;
    private readonly string _dbPath;

    public AppDatabase(string dbPath)
    {
        _dbPath = dbPath;
    }

    private async Task<SQLiteAsyncConnection> GetConnectionAsync()
    {
        if (_db is not null) return _db;

        _db = new SQLiteAsyncConnection(_dbPath, SQLiteOpenFlags.ReadWrite | SQLiteOpenFlags.Create | SQLiteOpenFlags.SharedCache);

        // Create all tables
        await _db.CreateTableAsync<EngineerModel>();
        await _db.CreateTableAsync<ProjectModel>();
        await _db.CreateTableAsync<IndentModel>();
        await _db.CreateTableAsync<IndentItemModel>();
        await _db.CreateTableAsync<WarehouseModel>();
        await _db.CreateTableAsync<LocationModel>();
        await _db.CreateTableAsync<ActivityModel>();
        await _db.CreateTableAsync<ItemModel>();
        await _db.CreateTableAsync<ServiceOrderModel>();
        await _db.CreateTableAsync<SyncLogModel>();
        await _db.CreateTableAsync<OfflineQueueModel>();

        return _db;
    }

    // ─── Engineers ───────────────────────────────────────────────────────────

    public async Task<EngineerModel?> GetEngineerAsync(string engineerId)
    {
        var db = await GetConnectionAsync();
        return await db.Table<EngineerModel>()
            .Where(e => e.EngineerId == engineerId)
            .FirstOrDefaultAsync();
    }

    public async Task UpsertEngineersAsync(List<EngineerModel> engineers)
    {
        var db = await GetConnectionAsync();
        await db.RunInTransactionAsync(conn =>
        {
            foreach (var e in engineers) conn.InsertOrReplace(e);
        });
    }

    // ─── Projects ────────────────────────────────────────────────────────────

    public async Task<List<ProjectModel>> GetProjectsForEngineerAsync(string engineerId)
    {
        var db = await GetConnectionAsync();
        return await db.Table<ProjectModel>()
            .Where(p => p.EngineerId == engineerId)
            .ToListAsync();
    }

    public async Task UpsertProjectsAsync(List<ProjectModel> projects)
    {
        var db = await GetConnectionAsync();
        await db.RunInTransactionAsync(conn =>
        {
            foreach (var p in projects) conn.InsertOrReplace(p);
        });
    }

    // ─── Indents ─────────────────────────────────────────────────────────────

    public async Task<List<IndentModel>> GetIndentsAsync(string engineerId)
    {
        var db = await GetConnectionAsync();
        return await db.Table<IndentModel>()
            .Where(i => i.EngineerId == engineerId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();
    }

    public async Task<int> SaveIndentAsync(IndentModel indent)
    {
        var db = await GetConnectionAsync();
        return indent.IndentId == 0
            ? await db.InsertAsync(indent)
            : await db.UpdateAsync(indent);
    }

    // ─── Indent Items ─────────────────────────────────────────────────────────

    public async Task<List<IndentItemModel>> GetItemsForIndentAsync(int indentId)
    {
        var db = await GetConnectionAsync();
        return await db.Table<IndentItemModel>()
            .Where(i => i.IndentId == indentId)
            .ToListAsync();
    }

    public async Task<int> SaveIndentItemAsync(IndentItemModel item)
    {
        var db = await GetConnectionAsync();
        return item.ItemLineId == 0
            ? await db.InsertAsync(item)
            : await db.UpdateAsync(item);
    }

    // ─── Master Data Upserts ─────────────────────────────────────────────────

    public async Task UpsertWarehousesAsync(List<WarehouseModel> warehouses)
    {
        var db = await GetConnectionAsync();
        await db.RunInTransactionAsync(conn => { foreach (var w in warehouses) conn.InsertOrReplace(w); });
    }

    public async Task UpsertLocationsAsync(List<LocationModel> locations)
    {
        var db = await GetConnectionAsync();
        await db.RunInTransactionAsync(conn => { foreach (var l in locations) conn.InsertOrReplace(l); });
    }

    public async Task UpsertActivitiesAsync(List<ActivityModel> activities)
    {
        var db = await GetConnectionAsync();
        await db.RunInTransactionAsync(conn => { foreach (var a in activities) conn.InsertOrReplace(a); });
    }

    public async Task UpsertItemsAsync(List<ItemModel> items)
    {
        var db = await GetConnectionAsync();
        await db.RunInTransactionAsync(conn => { foreach (var i in items) conn.InsertOrReplace(i); });
    }

    public async Task UpsertServiceOrdersAsync(List<ServiceOrderModel> orders)
    {
        var db = await GetConnectionAsync();
        await db.RunInTransactionAsync(conn => { foreach (var o in orders) conn.InsertOrReplace(o); });
    }

    // ─── Sync Log ─────────────────────────────────────────────────────────────

    public async Task SaveSyncLogAsync(string engineerId, string syncType, DateTime startedAt, string status)
    {
        var db = await GetConnectionAsync();
        await db.InsertAsync(new SyncLogModel
        {
            EngineerId = engineerId,
            SyncType = syncType,
            StartedAt = startedAt,
            CompletedAt = DateTime.UtcNow,
            Status = status
        });
    }

    // ─── Offline Queue ────────────────────────────────────────────────────────

    public async Task<List<OfflineQueueModel>> GetOfflineQueueAsync()
    {
        var db = await GetConnectionAsync();
        return await db.Table<OfflineQueueModel>()
            .Where(q => q.SyncedAt == null)
            .OrderBy(q => q.CreatedAt)
            .ToListAsync();
    }

    public async Task MarkOfflineItemSyncedAsync(int queueId)
    {
        var db = await GetConnectionAsync();
        var item = await db.FindAsync<OfflineQueueModel>(queueId);
        if (item is not null) { item.SyncedAt = DateTime.UtcNow; await db.UpdateAsync(item); }
    }

    public async Task IncrementRetryCountAsync(int queueId)
    {
        var db = await GetConnectionAsync();
        var item = await db.FindAsync<OfflineQueueModel>(queueId);
        if (item is not null) { item.RetryCount++; await db.UpdateAsync(item); }
    }
}
