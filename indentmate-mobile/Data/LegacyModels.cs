using SQLite;

namespace IndentMate.Mobile.Data;

[Table("Engineers")]
public class EngineerModel
{
    [PrimaryKey, AutoIncrement] public int Id { get; set; }
    [Indexed] public string EngineerId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PinHash { get; set; } = string.Empty;
    public string LnEnvironment { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string ResponsibilityCode { get; set; } = string.Empty;
    public DateTime? ValidTo { get; set; }
    public DateTime LastSync { get; set; }
}

[Table("Projects")]
public class ProjectModel
{
    [PrimaryKey] public string ProjectId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string AddressCode { get; set; } = string.Empty;
    public string Site { get; set; } = string.Empty;
    public string EngineerId { get; set; } = string.Empty;
}

[Table("Indents")]
public class IndentModel
{
    [PrimaryKey, AutoIncrement] public int IndentId { get; set; }
    public string RequestNo { get; set; } = string.Empty;
    public string EngineerId { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string IndentType { get; set; } = string.Empty;
    public string EngineerType { get; set; } = string.Empty;
    public string Status { get; set; } = "Created";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    public bool IsSynced { get; set; }
}

public class IndentSummary
{
    public int IndentId { get; set; }
    public string RequestNo { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

[Table("IndentItems")]
public class IndentItemModel
{
    [PrimaryKey, AutoIncrement] public int ItemLineId { get; set; }
    [Indexed] public int IndentId { get; set; }
    public string MaterialCode { get; set; } = string.Empty;
    public string WorkType { get; set; } = string.Empty;
    public string ActivityId { get; set; } = string.Empty;
    public string LocationId { get; set; } = string.Empty;
    public string UoM { get; set; } = string.Empty;
    public decimal RequestedQty { get; set; }
    public string Remarks { get; set; } = string.Empty;
    public string AttachmentUrl { get; set; } = string.Empty;
}

[Table("Warehouses")]
public class WarehouseModel
{
    [PrimaryKey] public string WarehouseCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Site { get; set; } = string.Empty;
    public bool IsMaterialWH { get; set; }
    public bool IsVirtual { get; set; }
    public string VirtualWHCode { get; set; } = string.Empty;
}

[Table("Locations")]
public class LocationModel
{
    [PrimaryKey] public string LocationCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string WarehouseCode { get; set; } = string.Empty;
}

[Table("Activities")]
public class ActivityModel
{
    [PrimaryKey] public string ActivityId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ActivityType { get; set; } = string.Empty;
    public string CapacityType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool IsMultilocation { get; set; }
    public bool DprEngineerControl { get; set; }
}

[Table("Items")]
public class ItemModel
{
    [PrimaryKey] public string ItemCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string PurchaseUnit { get; set; } = string.Empty;
    public string ItemType { get; set; } = string.Empty;
    public int ItemGroup { get; set; }
    public string SiteCode { get; set; } = string.Empty;
    public decimal OnHandQty { get; set; }
}

[Table("ServiceOrders")]
public class ServiceOrderModel
{
    [PrimaryKey] public string OrderNo { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string SiteCode { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string Equipment { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string OrderType { get; set; } = string.Empty;
}

[Table("SyncLog")]
public class SyncLogModel
{
    [PrimaryKey, AutoIncrement] public int SyncId { get; set; }
    public string EngineerId { get; set; } = string.Empty;
    public string SyncType { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string ErrorMsg { get; set; } = string.Empty;
}

[Table("OfflineQueue")]
public class OfflineQueueModel
{
    [PrimaryKey, AutoIncrement] public int QueueId { get; set; }
    public string EngineerId { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int RetryCount { get; set; }
    public DateTime? SyncedAt { get; set; }
}
