using SQLite;

namespace IndentMate.Mobile.Data;

// ─────────────────────────────────────────────────────────────────────────────
// LocalEngineer
// Mirrors the Engineer EF entity for offline storage on device
// ─────────────────────────────────────────────────────────────────────────────

[Table("LocalEngineers")]
public class LocalEngineer
{
    [PrimaryKey]
    [MaxLength(50)]
    public string EngineerId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string PinHash { get; set; } = string.Empty;
    public string LNEnvironment { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string ResponsibilityCode { get; set; } = string.Empty;  // SIE | SER
    public DateTime? ValidTo { get; set; }
    public DateTime? LastSyncAt { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalProject
// ─────────────────────────────────────────────────────────────────────────────

[Table("LocalProjects")]
public class LocalProject
{
    [PrimaryKey]
    public string ProjectId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string SiteCode { get; set; } = string.Empty;
    public string AddressCode { get; set; } = string.Empty;
    public string EngineerId { get; set; } = string.Empty;
    public string ResponsibilityCode { get; set; } = string.Empty;
    public string DisplayName => string.IsNullOrWhiteSpace(Description)
        ? ProjectId
        : $"{ProjectId} – {Description}";
}

[Table("LocalActivities")]
public class LocalActivity
{
    [PrimaryKey]
    public string ActivityId { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ActivityType { get; set; } = string.Empty;
    public string CapacityType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool IsMultilocation { get; set; }
    public bool DprEngineerControl { get; set; }
    [Ignore]
    public string DisplayName => string.IsNullOrWhiteSpace(Description) ? ActivityId : $"{ActivityId} – {Description}";
}

[Table("LocalLocations")]
public class LocalLocation
{
    [PrimaryKey]
    public string LocationCode { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string WarehouseCode { get; set; } = string.Empty;
    [Ignore]
    public string DisplayName => string.IsNullOrWhiteSpace(Description) ? LocationCode : $"{LocationCode} – {Description}";
}

[Table("LocalBusinessPartners")]
public class LocalBusinessPartner
{
    [PrimaryKey]
    public string BusinessPartnerId { get; set; } = string.Empty;
    public string ActivityId { get; set; } = string.Empty;
    public string LocationCode { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool SubcontractorPO { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalIndent
// ─────────────────────────────────────────────────────────────────────────────

[Table("LocalIndents")]
public class LocalIndent
{
    [PrimaryKey]
    public string IndentId { get; set; } = Guid.NewGuid().ToString();

    public string RequestNo { get; set; } = string.Empty;
    public string OfficialIndentNo { get; set; } = string.Empty;
    public string EngineerId { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public string IndentType { get; set; } = string.Empty;   // Issue | IssueReturn
    public string EngineerType { get; set; } = string.Empty; // SIE | SER
    public string FromLocationId { get; set; } = string.Empty;
    public string FromLocationName { get; set; } = string.Empty;
    public string ToContractorId { get; set; } = string.Empty;
    public string ToContractorName { get; set; } = string.Empty;
    public string OrderNo { get; set; } = string.Empty;
    public string OrderType { get; set; } = string.Empty; // Service | Rental
    public string EquipmentDisplay { get; set; } = string.Empty;
    public string Status { get; set; } = "Created";
    // Created | PendingApproval | Approved | Rejected
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    public bool IsSynced { get; set; } = false;
    public string SyncErrorMessage { get; set; } = string.Empty;
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalIndentItem
// ─────────────────────────────────────────────────────────────────────────────

[Table("LocalIndentItems")]
public class LocalIndentItem
{
    [PrimaryKey]
    public string ItemLineId { get; set; } = Guid.NewGuid().ToString();

    [Indexed]
    public string IndentId { get; set; } = string.Empty;

    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialDesc { get; set; } = string.Empty;
    public string WorkType { get; set; } = string.Empty;    // BOQ | NONBOQ
    public string ActivityId { get; set; } = string.Empty;
    public string LocationId { get; set; } = string.Empty;
    public string UoM { get; set; } = string.Empty;
    public decimal RequestedQty { get; set; }
    public string Remarks { get; set; } = string.Empty;
    public string AttachmentUrl { get; set; } = string.Empty;
    public string BusinessPartnerId { get; set; } = string.Empty;
    public string BusinessPartnerName { get; set; } = string.Empty;
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalWarehouse
// Source: LN Session whwmd2500m000
// ─────────────────────────────────────────────────────────────────────────────

[Table("LocalWarehouses")]
public class LocalWarehouse
{
    [PrimaryKey]
    public string WarehouseCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string SiteCode { get; set; } = string.Empty;
    public bool IsMaterialWH { get; set; }
    public bool IsVirtual { get; set; }
    public string VirtualWHCode { get; set; } = string.Empty;
    public string DisplayName => string.IsNullOrWhiteSpace(Description)
        ? WarehouseCode
        : $"{WarehouseCode} – {Description}";
}

[Table("LocalWarehouseLocations")]
public class LocalWarehouseLocation
{
    [PrimaryKey]
    public string LocationCode { get; set; } = string.Empty;
    public string WarehouseCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // Storage | Employee | Subcon
}

[Table("LocalDeliveryPoints")]
public class LocalDeliveryPoint
{
    [PrimaryKey]
    public string DeliveryPointCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string AddressCode { get; set; } = string.Empty;
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalItem (Material Master)
// Source: LN Session tdipu0181m000 (Items — Purchase by Site)
// Excludes ItemGroup 99 and 35 at sync time
// ─────────────────────────────────────────────────────────────────────────────

[Table("LocalItems")]
public class LocalItem
{
    [PrimaryKey]
    public string ItemCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string PurchaseUnit { get; set; } = string.Empty;
    public int ItemGroup { get; set; }
    public string SiteCode { get; set; } = string.Empty;
    public decimal OnHandQty { get; set; }
    public string UoM { get; set; } = string.Empty;
    [Ignore]
    public string DisplayName => string.IsNullOrWhiteSpace(Description) ? ItemCode : $"{ItemCode} – {Description}";
}

[Table("LocalServiceOrders")]
public class LocalServiceOrder
{
    [PrimaryKey]
    public string OrderNo { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string SiteCode { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string Equipment { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

[Table("LocalRentalOrders")]
public class LocalRentalOrder
{
    [PrimaryKey]
    public string OrderNo { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string SiteCode { get; set; } = string.Empty;
    public string ProjectCode { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string Equipment { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

[Table("SyncLog")]
public class SyncLog
{
    [PrimaryKey, AutoIncrement]
    public int SyncId { get; set; }
    public string EngineerId { get; set; } = string.Empty;
    public string SessionCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string ErrorMessage { get; set; } = string.Empty;
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalOfflineQueue
// Holds indents created/modified while device is offline
// ─────────────────────────────────────────────────────────────────────────────

[Table("LocalOfflineQueue")]
public class LocalOfflineQueue
{
    [PrimaryKey]
    public string QueueId { get; set; } = Guid.NewGuid().ToString();

    public string EngineerId { get; set; } = string.Empty;

    /// <summary>Full JSON payload of the indent to POST to API.</summary>
    public string PayloadJson { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int RetryCount { get; set; } = 0;
    public DateTime? SyncedAt { get; set; }
}
