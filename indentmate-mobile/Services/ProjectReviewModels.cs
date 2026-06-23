using Newtonsoft.Json;

namespace IndentMate.Mobile.Services;

public sealed record ProjectReviewListResult(
    List<ProjectReviewIndentSummary> Data,
    int Total,
    int Page,
    int Limit,
    int TotalPages,
    bool HasMore);

public class ProjectReviewIndentSummary
{
    [JsonProperty("id")]
    public string Id { get; set; } = string.Empty;

    [JsonProperty("app_request_id")]
    public string AppRequestId { get; set; } = string.Empty;

    [JsonProperty("indent_no")]
    public string IndentNo { get; set; } = string.Empty;

    [JsonProperty("project_code")]
    public string ProjectCode { get; set; } = string.Empty;

    [JsonProperty("project_name")]
    public string ProjectName { get; set; } = string.Empty;

    [JsonProperty("source_warehouse")]
    public string SourceWarehouse { get; set; } = string.Empty;

    [JsonProperty("source_warehouse_name")]
    public string SourceWarehouseName { get; set; } = string.Empty;

    [JsonProperty("source_location")]
    public string SourceLocation { get; set; } = string.Empty;

    [JsonProperty("delivery_location")]
    public string DeliveryLocation { get; set; } = string.Empty;

    [JsonProperty("indent_type")]
    public string IndentType { get; set; } = string.Empty;

    [JsonProperty("requirement_type")]
    public string RequirementType { get; set; } = string.Empty;

    [JsonProperty("status")]
    public string Status { get; set; } = string.Empty;

    [JsonProperty("created_at")]
    public DateTime CreatedAt { get; set; }

    public string DisplayRequest => string.IsNullOrWhiteSpace(AppRequestId) ? IndentNo : AppRequestId;
    public string ProjectDisplay => string.IsNullOrWhiteSpace(ProjectName) ? ProjectCode : $"{ProjectCode} - {ProjectName}";
    public string WarehouseDisplay => string.IsNullOrWhiteSpace(SourceWarehouseName) ? SourceWarehouse : $"{SourceWarehouse} - {SourceWarehouseName}";
    public string TypeDisplay => string.IsNullOrWhiteSpace(IndentType) ? RequirementType : IndentType;
}

public sealed class ProjectReviewIndentDetail : ProjectReviewIndentSummary
{
    [JsonProperty("created_by")]
    public string CreatedBy { get; set; } = string.Empty;

    [JsonProperty("created_by_name")]
    public string CreatedByName { get; set; } = string.Empty;

    [JsonProperty("approved_by")]
    public string ApprovedBy { get; set; } = string.Empty;

    [JsonProperty("approved_by_name")]
    public string ApprovedByName { get; set; } = string.Empty;

    [JsonProperty("delivery_location_name")]
    public string DeliveryLocationName { get; set; } = string.Empty;

    [JsonProperty("to_entity_id")]
    public string ToEntityId { get; set; } = string.Empty;

    [JsonProperty("to_entity_type")]
    public string ToEntityType { get; set; } = string.Empty;

    [JsonProperty("items")]
    public List<ProjectReviewLineItem> Items { get; set; } = new();

    public string CreatedByDisplay => string.IsNullOrWhiteSpace(CreatedByName) ? CreatedBy : $"{CreatedBy} - {CreatedByName}";
    public string StatusByDisplay => string.IsNullOrWhiteSpace(ApprovedByName) ? ApprovedBy : $"{ApprovedBy} - {ApprovedByName}";
    public string DeliveryDisplay => string.IsNullOrWhiteSpace(DeliveryLocationName) ? DeliveryLocation : $"{DeliveryLocation} - {DeliveryLocationName}";
    public string ToDisplay => string.IsNullOrWhiteSpace(ToEntityId) ? ToEntityType : ToEntityId;
}

public sealed class ProjectReviewLineItem
{
    [JsonProperty("id")]
    public string Id { get; set; } = string.Empty;

    [JsonProperty("line_number")]
    public int LineNumber { get; set; }

    [JsonProperty("item_code")]
    public string ItemCode { get; set; } = string.Empty;

    [JsonProperty("item_name")]
    public string ItemName { get; set; } = string.Empty;

    [JsonProperty("uom")]
    public string UoM { get; set; } = string.Empty;

    [JsonProperty("required_qty")]
    public decimal RequiredQty { get; set; }

    [JsonProperty("approved_qty")]
    public decimal ApprovedQty { get; set; }

    [JsonProperty("in_process_qty")]
    public decimal InProcessQty { get; set; }

    [JsonProperty("issued_qty")]
    public decimal IssuedQty { get; set; }

    [JsonProperty("on_hand_qty")]
    public decimal OnHandQty { get; set; }

    [JsonProperty("work_type")]
    public string WorkType { get; set; } = string.Empty;

    [JsonProperty("activity_code")]
    public string ActivityCode { get; set; } = string.Empty;

    [JsonProperty("location_code")]
    public string LocationCode { get; set; } = string.Empty;

    [JsonProperty("remarks")]
    public string Remarks { get; set; } = string.Empty;

    [JsonProperty("attachment_url")]
    public string AttachmentUrl { get; set; } = string.Empty;

    public string MaterialDisplay => string.IsNullOrWhiteSpace(ItemName) ? ItemCode : $"{ItemCode} - {ItemName}";
}

public sealed class ProjectReviewApprovalLine
{
    [JsonProperty("id")]
    public string Id { get; set; } = string.Empty;

    [JsonProperty("line_number")]
    public int LineNumber { get; set; }

    [JsonProperty("approved_qty")]
    public decimal ApprovedQty { get; set; }
}
