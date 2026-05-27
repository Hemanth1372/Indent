# IndentMate Database Setup Guide

## ✅ Completed Tasks (Today's Requirements)

### Prompt 1: EF Core Models & DbContext (SQL Server)

#### 1. Entity Classes ✅
Created in `IndentMate.Shared\Entities\IndentEntities.cs`:
- **Engineer**: EngineerId (PK), Name, PinHash, LNEnvironment, Company, ResponsibilityCode, LastSyncAt
- **Project**: ProjectId (PK), Description, AddressCode, SiteCode
- **Indent**: IndentId (PK, auto GUID), RequestNo, EngineerId (FK), ProjectId (FK), WarehouseId, IndentType, Status, CreatedAt, SubmittedAt
- **IndentItem**: ItemLineId (PK, auto GUID), IndentId (FK), MaterialCode, MaterialDesc, WorkType, ActivityId, LocationId, UoM, RequestedQty, Remarks, AttachmentUrl
- **Warehouse**: WarehouseCode (PK), Description, SiteCode, IsMaterialWH, IsVirtual, VirtualWHCode
- **Item**: ItemCode (PK), Description, PurchaseUnit, ItemType, ItemGroup, SiteCode, OnHandQty
- **SyncLog**: SyncId (PK, auto GUID), EngineerId, SessionCode, StartedAt, CompletedAt, Status, ErrorMessage
- **OfflineQueue**: QueueId (PK, auto GUID), EngineerId, PayloadJson, CreatedAt, RetryCount, SyncedAt

#### 2. IndentMateDbContext ✅
Created in `IndentMate.API\Data\IndentMateDbContext.cs`:
- All 8 DbSets defined
- Fluent API configuration for:
  - Primary keys with NEWID() defaults for GUIDs
  - Foreign key relationships with appropriate delete behaviors
  - Indexes on frequently queried columns (Status, CreatedAt, SiteCode, etc.)
  - Decimal precision (18,4) for quantities
  - String length constraints matching entity attributes

#### 3. EF Core Migration ✅
Created: `IndentMate.API\Data\Migrations\20260527045409_InitialCreate.cs`
- All 8 tables generated with correct column types
- Foreign keys configured (Restrict for Indent, Cascade for logs/queue)
- Indexes created for performance
- Test engineer seed data added: EngineerId="ENG001", Name="Test Engineer"

---

### Prompt 2: SQLite Local Schema (MAUI)

#### 1. SQLite Table Models ✅
Created in `IndentMate.Mobile\Data\LocalDatabase.cs` with `[Table]` and `[PrimaryKey]` attributes:
- **LocalEngineer**: mirrors Engineer (includes ValidTo, LastSyncAt)
- **LocalProject**: ProjectId, Description, SiteCode, AddressCode, EngineerId
- **LocalIndent**: all fields + IsSynced flag for offline tracking
- **LocalIndentItem**: same as IndentItem (ItemLineId indexed for indent queries)
- **LocalWarehouse**: WarehouseCode, Description, SiteCode, IsMaterialWH, IsVirtual, VirtualWHCode
- **LocalItem**: ItemCode, Description, PurchaseUnit, ItemGroup, SiteCode, OnHandQty (excludes ItemType)
- **LocalOfflineQueue**: QueueId, EngineerId, PayloadJson, CreatedAt, RetryCount, SyncedAt

#### 2. DatabaseService ✅
Created in `IndentMate.Mobile\Data\DatabaseService.cs` with:
- **InitAsync()**: Creates all 7 SQLite tables, thread-safe with SemaphoreSlim
- **GetAllAsync<T>()**: Returns all rows for type T
- **SaveAsync<T>(item)**: InsertOrReplace (upsert) for idempotent syncs
- **DeleteAsync<T>(item)**: Deletes by PK
- **GetIndentByIdAsync(indentId)**: Special query to load single indent
- **Plus 10+ helper methods**:
  - GetIndentsForEngineerAsync, GetIndentsByStatusAsync, CountIndentsByStatusAsync
  - GetItemsForIndentAsync, GetProjectsForEngineerAsync, GetWarehousesForSiteAsync
  - GetItemsForSiteAsync, GetEngineerAsync, GetPendingOfflineQueueAsync
  - SaveBatchAsync, ResetDatabaseAsync, queue retry/sync tracking

---

## 📋 Current Setup Status

### SQL Server (API)
1. ✅ Entities defined in Shared library
2. ✅ DbContext with seed data (ENG001)
3. ✅ Migration "InitialCreate" created
4. ⏳ **TO DO**: Apply migration to actual SQL Server database

### SQLite (Mobile)
1. ✅ Local table models with sqlite-net-pcl attributes
2. ✅ DatabaseService fully implemented
3. ✅ MauiProgram.cs updated with DI registration:
   - DatabaseService singleton registered
   - DB path: `{FileSystem.AppDataDirectory}/indentmate.db`
   - InitAsync() called at startup (Task.Run, non-blocking)
4. ✅ Package dependencies: `sqlite-net-pcl` v1.9.172, `SQLitePCLRaw.bundle_green` v2.1.10
5. ✅ Build successful (all compilation errors fixed)

---

## 🔧 Next Steps (Manual Configuration)

### 1. Configure SQL Server Connection
Edit `IndentMate.API\appsettings.json`:
```json
{
  "ConnectionStrings": {
	"DefaultConnection": "Server=YOUR_SERVER;Database=IndentMateDB;User Id=YOUR_USER;Password=YOUR_PASSWORD;TrustServerCertificate=True;"
  }
}
```

### 2. Apply Database Migration
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\
dotnet ef database update --project IndentMate.API --startup-project IndentMate.API
```

This will:
- Create all 8 tables in SQL Server
- Add test engineer (ENG001 / Test Engineer)
- Create all indexes

### 3. Verify Mobile Setup
- Run IndentMate.Mobile on Android/Windows emulator
- Check `{FileSystem.AppDataDirectory}/indentmate.db` file exists after first launch
- Verify DatabaseService.GetAllAsync<LocalEngineer>() works

### 4. Test Integration
- Post a new Indent to `/api/indents` (requires auth)
- Call `/api/sync` to pull data to mobile
- Verify data appears in mobile SQLite via DatabaseService queries

---

## 📊 Schema Architecture

### Foreign Key Relationships
```
Engineer (1) ──→ (Many) Indent
			──→ (Many) SyncLog
			──→ (Many) OfflineQueue

Project  (1) ──→ (Many) Indent

Indent   (1) ──→ (Many) IndentItem
```

### Delete Cascades
- Engineer → Indent: **Restrict** (protect audit trail)
- Engineer → SyncLog: **Cascade**
- Engineer → OfflineQueue: **Cascade**
- Indent → IndentItem: **Cascade** (delete items when indent deleted)
- Project → Indent: **Restrict** (protect project history)

---

## 🔑 Seed Data

### Test Engineer
- **EngineerId**: ENG001
- **Name**: Test Engineer
- **PinHash**: 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92 (SHA256("123456"))
  - ⚠️ Replace with BCrypt in production
- **LNEnvironment**: TST (Test)
- **Company**: 100
- **ResponsibilityCode**: SIE (Site Engineer)

---

## 📝 Files Modified Today

1. ✅ `IndentMate.Shared\Entities\IndentEntities.cs` — 8 entity classes
2. ✅ `IndentMate.API\Data\IndentMateDbContext.cs` — DbContext with Fluent API
3. ✅ `IndentMate.API\Data\Migrations\20260527045409_InitialCreate.cs` — Migration
4. ✅ `IndentMate.Mobile\Data\LocalDatabase.cs` — 7 local table models
5. ✅ `IndentMate.Mobile\Data\DatabaseService.cs` — Full CRUD + special queries
6. ✅ `IndentMate.Mobile\MauiProgram.cs` — Fixed `.UseMauiApp<App>()` + DI setup
7. ✅ `IndentMate.Mobile\IndentMate.Mobile.csproj` — SQLite packages (already present)

---

## 🧪 Testing Checklist

- [ ] SQL Server: Run `dotnet ef database update` successfully
- [ ] SQL Server: Query `SELECT * FROM Engineers` → should show ENG001
- [ ] Mobile: Launch app, check DB file created
- [ ] Mobile: Call `await databaseService.GetEngineerAsync("ENG001")` → should return test engineer (after sync)
- [ ] Mobile: Create LocalIndent, call `SaveAsync()`, query `GetIndentByIdAsync()` → persist & retrieve works
- [ ] Offline Queue: Create LocalOfflineQueue, call `GetPendingOfflineQueueAsync()` → returns unsync'd items

---

## 📚 References

- EF Core Migrations: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/
- sqlite-net-pcl Docs: https://github.com/praeclarum/sqlite-net
- MAUI DI: https://learn.microsoft.com/en-us/dotnet/maui/fundamentals/dependency-injection

---

**Status**: ✅ **COMPLETE** — All day 2 requirements implemented. Ready for manual DB apply + integration testing.
