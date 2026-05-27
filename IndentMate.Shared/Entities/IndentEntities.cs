using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IndentMate.Shared.Entities;

// ─────────────────────────────────────────────────────────────────────────────
// Engineer
// Source: LN Session tppdm6149m000 (Responsibility by Employees)
// ─────────────────────────────────────────────────────────────────────────────

public class Engineer
{
    [Key]
    [MaxLength(50)]
    public string EngineerId { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(512)]
    public string PinHash { get; set; } = string.Empty;

    [Required, MaxLength(10)]
    public string LNEnvironment { get; set; } = string.Empty;  // PRD | TRN | TST

    [Required, MaxLength(20)]
    public string Company { get; set; } = string.Empty;

    [Required, MaxLength(10)]
    public string ResponsibilityCode { get; set; } = string.Empty;  // SIE | SER

    public DateTime? ValidTo { get; set; }

    public DateTime? LastSyncAt { get; set; }

    // Navigation
    public ICollection<Indent> Indents { get; set; } = new List<Indent>();
    public ICollection<SyncLog> SyncLogs { get; set; } = new List<SyncLog>();
    public ICollection<OfflineQueue> OfflineQueues { get; set; } = new List<OfflineQueue>();
}

// ─────────────────────────────────────────────────────────────────────────────
// Project
// Source: LN Session tppdm6100m000
// ─────────────────────────────────────────────────────────────────────────────

public class Project
{
    [Key]
    [MaxLength(50)]
    public string ProjectId { get; set; } = string.Empty;

    [Required, MaxLength(300)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(50)]
    public string AddressCode { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SiteCode { get; set; } = string.Empty;

    // Navigation
    public ICollection<Indent> Indents { get; set; } = new List<Indent>();
}

// ─────────────────────────────────────────────────────────────────────────────
// Indent (Material Request Header)
// ─────────────────────────────────────────────────────────────────────────────

public class Indent
{
    [Key]
    [MaxLength(50)]
    public string IndentId { get; set; } = Guid.NewGuid().ToString();

    [MaxLength(50)]
    public string RequestNo { get; set; } = string.Empty;

    // FK → Engineer
    [Required, MaxLength(50)]
    public string EngineerId { get; set; } = string.Empty;

    // FK → Project
    [Required, MaxLength(50)]
    public string ProjectId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string WarehouseId { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string IndentType { get; set; } = string.Empty;   // Issue | IssueReturn

    [Required, MaxLength(20)]
    public string EngineerType { get; set; } = string.Empty; // SIE | SER

    [Required, MaxLength(20)]
    public string Status { get; set; } = "Created";
    // Created | PendingApproval | Approved | Rejected

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? SubmittedAt { get; set; }

    // Navigation
    [ForeignKey(nameof(EngineerId))]
    public Engineer? Engineer { get; set; }

    [ForeignKey(nameof(ProjectId))]
    public Project? Project { get; set; }

    public ICollection<IndentItem> Items { get; set; } = new List<IndentItem>();
}

// ─────────────────────────────────────────────────────────────────────────────
// IndentItem (Material Request Line)
// ─────────────────────────────────────────────────────────────────────────────

public class IndentItem
{
    [Key]
    [MaxLength(50)]
    public string ItemLineId { get; set; } = Guid.NewGuid().ToString();

    // FK → Indent
    [Required, MaxLength(50)]
    public string IndentId { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string MaterialCode { get; set; } = string.Empty;

    [MaxLength(300)]
    public string MaterialDesc { get; set; } = string.Empty;

    [MaxLength(20)]
    public string WorkType { get; set; } = string.Empty;  // BOQ | NONBOQ

    [MaxLength(50)]
    public string ActivityId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string LocationId { get; set; } = string.Empty;

    [MaxLength(20)]
    public string UoM { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,4)")]
    public decimal RequestedQty { get; set; }

    [MaxLength(500)]
    public string Remarks { get; set; } = string.Empty;

    [MaxLength(500)]
    public string AttachmentUrl { get; set; } = string.Empty;

    // Navigation
    [ForeignKey(nameof(IndentId))]
    public Indent? Indent { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Warehouse
// Source: LN Session whwmd2500m000
// ─────────────────────────────────────────────────────────────────────────────

public class Warehouse
{
    [Key]
    [MaxLength(50)]
    public string WarehouseCode { get; set; } = string.Empty;

    [Required, MaxLength(300)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SiteCode { get; set; } = string.Empty;

    public bool IsMaterialWH { get; set; }

    public bool IsVirtual { get; set; }

    [MaxLength(50)]
    public string? VirtualWHCode { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Item (Material)
// Source: LN Session tdipu0181m000
// ─────────────────────────────────────────────────────────────────────────────

public class Item
{
    [Key]
    [MaxLength(50)]
    public string ItemCode { get; set; } = string.Empty;

    [Required, MaxLength(300)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(20)]
    public string PurchaseUnit { get; set; } = string.Empty;

    [MaxLength(50)]
    public string ItemType { get; set; } = string.Empty;

    public int ItemGroup { get; set; }

    [MaxLength(50)]
    public string SiteCode { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,4)")]
    public decimal OnHandQty { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SyncLog
// Tracks every LN ERP sync operation
// ─────────────────────────────────────────────────────────────────────────────

public class SyncLog
{
    [Key]
    [MaxLength(50)]
    public string SyncId { get; set; } = Guid.NewGuid().ToString();

    [Required, MaxLength(50)]
    public string EngineerId { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SessionCode { get; set; } = string.Empty;  // e.g. tppdm6100m000

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; set; }

    [Required, MaxLength(20)]
    public string Status { get; set; } = "InProgress";  // Success | Failed | InProgress

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    // Navigation
    [ForeignKey(nameof(EngineerId))]
    public Engineer? Engineer { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// OfflineQueue
// Holds indents created while offline — uploaded on next sync
// ─────────────────────────────────────────────────────────────────────────────

public class OfflineQueue
{
    [Key]
    [MaxLength(50)]
    public string QueueId { get; set; } = Guid.NewGuid().ToString();

    [Required, MaxLength(50)]
    public string EngineerId { get; set; } = string.Empty;

    [Required]
    public string PayloadJson { get; set; } = string.Empty;  // Full JSON of the Indent

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int RetryCount { get; set; } = 0;

    public DateTime? SyncedAt { get; set; }

    // Navigation
    [ForeignKey(nameof(EngineerId))]
    public Engineer? Engineer { get; set; }
}
