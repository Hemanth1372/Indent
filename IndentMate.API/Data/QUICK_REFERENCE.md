# Quick Command Reference

## Build Commands

### Build Entire Solution (API & Shared only)
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\IndentMate.API\
dotnet build
```

### Build Shared Library
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\IndentMate.Shared\
dotnet build
```

### Release Build (Optimized)
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\IndentMate.API\
dotnet build -c Release
```

---

## EF Core Migrations

### List All Migrations
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\
dotnet ef migrations list --project IndentMate.API --startup-project IndentMate.API
```

### Apply Migration to SQL Server
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\
dotnet ef database update --project IndentMate.API --startup-project IndentMate.API
```

### Revert Last Migration
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\
dotnet ef database update <PREVIOUS_MIGRATION> --project IndentMate.API --startup-project IndentMate.API
```

### Create New Migration (after entity changes)
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\
dotnet ef migrations add <MigrationName> --project IndentMate.API --startup-project IndentMate.API
```

Example:
```powershell
dotnet ef migrations add AddNewField --project IndentMate.API --startup-project IndentMate.API
```

---

## SQL Server Verification

### Connect to SQL Server (LocalDB or express)
```powershell
# Using sqlcmd (if SQL Server CLI installed)
sqlcmd -S YOUR_SERVER -d IndentMateDB -U YOUR_USER -P YOUR_PASSWORD
```

### Query Test Data
```sql
-- View tables created
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo'

-- Check seed engineer
SELECT * FROM Engineers

-- Count indents
SELECT COUNT(*) FROM Indents

-- View sync logs
SELECT * FROM SyncLogs ORDER BY StartedAt DESC
```

---

## SQLite Verification (Mobile)

### Inspect SQLite Database

#### Option 1: Via .NET MAUI App (in ViewModel/CodeBehind)
```csharp
var databaseService = new DatabaseService(
	Path.Combine(FileSystem.AppDataDirectory, "indentmate.db"));
await databaseService.InitAsync();

// Get all engineers
var engineers = await databaseService.GetAllAsync<LocalEngineer>();

// Query specific indent
var indent = await databaseService.GetIndentByIdAsync("some-indent-id");

// Get engineer
var eng = await databaseService.GetEngineerAsync("ENG001");
```

#### Option 2: SQLite CLI (if installed)
```powershell
# On Windows, db is usually at:
# C:\Users\Hemanth\AppData\Local\indentmate.db (for emulator)

sqlite3 indentmate.db

# Inside sqlite3 prompt:
.tables                          # List all tables
.schema LocalIndent              # View schema of LocalIndent
SELECT * FROM LocalEngineers;    # Query engineers
SELECT COUNT(*) FROM LocalIndents;  # Count indents
.quit
```

#### Option 3: Visual Studio Data Explorer
1. Tools → Options → Database Tools → Data Connections
2. Add SQLite connection
3. Browse tables and data

---

## Development Workflow

### 1. Make Entity Changes (IndentMate.Shared)
```csharp
// Edit IndentMate.Shared\Entities\IndentEntities.cs
// Add property, change constraint, etc.
```

### 2. Create Migration
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\
dotnet ef migrations add DescriptiveNameOfChange --project IndentMate.API --startup-project IndentMate.API
```

### 3. Review Migration
```powershell
# Check the migration file in IndentMate.API\Data\Migrations\
```

### 4. Apply to Database
```powershell
dotnet ef database update --project IndentMate.API --startup-project IndentMate.API
```

### 5. Rebuild
```powershell
cd C:\Users\Hemanth\OneDrive\Desktop\IndentMate\IndentMate.API\
dotnet build
```

---

## LocalDatabase.cs CRUD Examples

### Initialize (Called in MauiProgram.cs)
```csharp
var databaseService = new DatabaseService(
	Path.Combine(FileSystem.AppDataDirectory, "indentmate.db"));
await databaseService.InitAsync();
```

### Create (Insert)
```csharp
var newIndent = new LocalIndent
{
	IndentId = Guid.NewGuid().ToString(),
	RequestNo = "REQ-001",
	EngineerId = "ENG001",
	ProjectId = "PROJ-001",
	IndentType = "Issue",
	Status = "Created",
	CreatedAt = DateTime.UtcNow
};
await databaseService.SaveAsync(newIndent);
```

### Read (Query)
```csharp
// Single indent by ID
var indent = await databaseService.GetIndentByIdAsync(indentId);

// All indents for engineer
var myIndents = await databaseService.GetIndentsForEngineerAsync("ENG001");

// By status
var createdIndents = await databaseService.GetIndentsByStatusAsync("ENG001", "Created");

// Count
var totalCreated = await databaseService.CountIndentsByStatusAsync("ENG001", "Created");
```

### Update (Upsert)
```csharp
// Modify the object
indent.Status = "PendingApproval";
indent.SubmittedAt = DateTime.UtcNow;

// Save (uses InsertOrReplace internally)
await databaseService.SaveAsync(indent);
```

### Delete
```csharp
await databaseService.DeleteAsync(indent);
```

### Batch Operations
```csharp
// Sync multiple items from server
var itemsFromServer = new List<LocalItem> { /* ... */ };
await databaseService.SaveBatchAsync(itemsFromServer);
```

---

## Offline Queue Workflow

### 1. Create Indent While Offline
```csharp
var offlineIndent = new LocalIndent { /* ... */ };
await databaseService.SaveAsync(offlineIndent);

// Queue for sync
var queueItem = new LocalOfflineQueue
{
	QueueId = Guid.NewGuid().ToString(),
	EngineerId = "ENG001",
	PayloadJson = JsonSerializer.Serialize(offlineIndent),
	CreatedAt = DateTime.UtcNow,
	RetryCount = 0,
	SyncedAt = null
};
await databaseService.SaveAsync(queueItem);
```

### 2. On Next Sync (When Online)
```csharp
// Get pending items
var pending = await databaseService.GetPendingOfflineQueueAsync();

foreach (var item in pending)
{
	try
	{
		// POST to API
		var response = await apiService.PostIndent(item.PayloadJson);

		// Mark as synced
		await databaseService.MarkQueueItemSyncedAsync(item.QueueId);
	}
	catch
	{
		// Increment retry count
		await databaseService.IncrementQueueRetryAsync(item.QueueId);

		// If max retries reached, handle error
		if (item.RetryCount >= 5)
		{
			// Log error, notify user, etc.
		}
	}
}
```

---

## Troubleshooting

### Build Fails: "NEWID() not supported"
✅ **Already fixed** - Using `HasDefaultValueSql("NEWID()")` in Fluent API (SQL Server specific)

### Migration Fails: "Pending migrations"
```powershell
# Check what's pending
dotnet ef migrations list --project IndentMate.API --startup-project IndentMate.API

# Apply all pending
dotnet ef database update --project IndentMate.API --startup-project IndentMate.API
```

### SQLite: "Table already exists"
```csharp
// Use ResetDatabaseAsync for full resync
await databaseService.ResetDatabaseAsync();
```

### Connection String Issues
```json
// Check appsettings.json
{
  "ConnectionStrings": {
	"DefaultConnection": "Server=YOUR_SERVER;Database=IndentMateDB;User Id=YOUR_USER;Password=YOUR_PASSWORD;TrustServerCertificate=True;"
  }
}
```

### EF Tools Not Found
```powershell
dotnet tool install --global dotnet-ef
```

---

## Configuration Files

### SQL Server Connection
**File**: `IndentMate.API\appsettings.json`
```json
{
  "ConnectionStrings": {
	"DefaultConnection": "Server=YOUR_SERVER;Database=IndentMateDB;..."
  }
}
```

### Mobile DB Path
**File**: `IndentMate.Mobile\MauiProgram.cs` (line 23)
```csharp
var dbPath = Path.Combine(FileSystem.AppDataDirectory, "indentmate.db");
```

---

## Key Files

| File | Purpose |
|------|---------|
| `IndentMate.Shared\Entities\IndentEntities.cs` | EF Core entity definitions |
| `IndentMate.API\Data\IndentMateDbContext.cs` | DbContext & Fluent API configuration |
| `IndentMate.API\Data\Migrations\20260527045409_InitialCreate.cs` | SQL Server schema migration |
| `IndentMate.Mobile\Data\LocalDatabase.cs` | SQLite local table models |
| `IndentMate.Mobile\Data\DatabaseService.cs` | SQLite CRUD service |
| `IndentMate.Mobile\MauiProgram.cs` | Dependency injection setup |
| `IndentMate.API\appsettings.json` | Connection strings & settings |

---

**Last Updated**: May 27, 2025
