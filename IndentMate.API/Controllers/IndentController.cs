using IndentMate.API.Data;
using IndentMate.Shared.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IndentMate.API.Controllers;

[ApiController]
[Route("api/indents")]
public class IndentController : ControllerBase
{
    private readonly IndentMateDbContext _db;

    public IndentController(IndentMateDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<PagedIndentResponse>> GetIndents(
        [FromQuery] string? engineerId,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Indents.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(engineerId))
            query = query.Where(indent => indent.EngineerId == engineerId);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(indent => indent.Status == status);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(indent => indent.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(indent => new IndentListItemResponse
            {
                IndentId = indent.IndentId,
                RequestNo = indent.RequestNo,
                EngineerId = indent.EngineerId,
                ProjectId = indent.ProjectId,
                WarehouseId = indent.WarehouseId,
                IndentType = indent.IndentType,
                EngineerType = indent.EngineerType,
                Status = indent.Status,
                CreatedAt = indent.CreatedAt,
                SubmittedAt = indent.SubmittedAt
            })
            .ToListAsync(ct);

        return Ok(new PagedIndentResponse(items, total, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<IndentDetailResponse>> GetIndent(string id, CancellationToken ct)
    {
        var indent = await _db.Indents
            .AsNoTracking()
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.IndentId == id, ct);

        if (indent is null)
            return NotFound();

        return Ok(IndentDetailResponse.FromEntity(indent));
    }

    [HttpPost]
    public async Task<ActionResult<CreateIndentResponse>> CreateIndent(
        [FromBody] CreateIndentRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.EngineerId) || string.IsNullOrWhiteSpace(request.ProjectId))
            return BadRequest("EngineerId and ProjectId are required.");

        var indent = new Indent
        {
            IndentId = Guid.NewGuid().ToString(),
            RequestNo = string.IsNullOrWhiteSpace(request.RequestNo)
                ? $"REQ-{DateTime.UtcNow:yyyyMMddHHmmss}"
                : request.RequestNo,
            EngineerId = request.EngineerId,
            ProjectId = request.ProjectId,
            WarehouseId = request.WarehouseId,
            IndentType = request.IndentType,
            EngineerType = request.EngineerType,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "Created" : request.Status,
            CreatedAt = DateTime.UtcNow,
            SubmittedAt = request.SubmittedAt,
            Items = request.Items.Select(item => new IndentItem
            {
                ItemLineId = Guid.NewGuid().ToString(),
                MaterialCode = item.MaterialCode,
                MaterialDesc = item.MaterialDesc,
                WorkType = item.WorkType,
                ActivityId = item.ActivityId,
                LocationId = item.LocationId,
                UoM = item.UoM,
                RequestedQty = item.RequestedQty,
                Remarks = item.Remarks,
                AttachmentUrl = item.AttachmentUrl
            }).ToList()
        };

        _db.Indents.Add(indent);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetIndent), new { id = indent.IndentId }, new CreateIndentResponse(indent.IndentId));
    }

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(
        string id,
        [FromBody] UpdateIndentStatusRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Status))
            return BadRequest("Status is required.");

        var indent = await _db.Indents.FirstOrDefaultAsync(i => i.IndentId == id, ct);
        if (indent is null)
            return NotFound();

        indent.Status = request.Status;
        if (request.Status == "PendingApproval" && indent.SubmittedAt is null)
            indent.SubmittedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record PagedIndentResponse(
    IReadOnlyList<IndentListItemResponse> Items,
    int Total,
    int Page,
    int PageSize);

public class IndentListItemResponse
{
    public string IndentId { get; set; } = string.Empty;
    public string RequestNo { get; set; } = string.Empty;
    public string EngineerId { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string IndentType { get; set; } = string.Empty;
    public string EngineerType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
}

public class IndentDetailResponse : IndentListItemResponse
{
    public IReadOnlyList<IndentItemResponse> Items { get; set; } = Array.Empty<IndentItemResponse>();

    public static IndentDetailResponse FromEntity(Indent indent)
    {
        return new IndentDetailResponse
        {
            IndentId = indent.IndentId,
            RequestNo = indent.RequestNo,
            EngineerId = indent.EngineerId,
            ProjectId = indent.ProjectId,
            WarehouseId = indent.WarehouseId,
            IndentType = indent.IndentType,
            EngineerType = indent.EngineerType,
            Status = indent.Status,
            CreatedAt = indent.CreatedAt,
            SubmittedAt = indent.SubmittedAt,
            Items = indent.Items.Select(item => new IndentItemResponse
            {
                ItemLineId = item.ItemLineId,
                MaterialCode = item.MaterialCode,
                MaterialDesc = item.MaterialDesc,
                WorkType = item.WorkType,
                ActivityId = item.ActivityId,
                LocationId = item.LocationId,
                UoM = item.UoM,
                RequestedQty = item.RequestedQty,
                Remarks = item.Remarks,
                AttachmentUrl = item.AttachmentUrl
            }).ToList()
        };
    }
}

public class IndentItemResponse
{
    public string ItemLineId { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialDesc { get; set; } = string.Empty;
    public string WorkType { get; set; } = string.Empty;
    public string ActivityId { get; set; } = string.Empty;
    public string LocationId { get; set; } = string.Empty;
    public string UoM { get; set; } = string.Empty;
    public decimal RequestedQty { get; set; }
    public string Remarks { get; set; } = string.Empty;
    public string AttachmentUrl { get; set; } = string.Empty;
}

public class CreateIndentRequest
{
    public string RequestNo { get; set; } = string.Empty;
    public string EngineerId { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string IndentType { get; set; } = string.Empty;
    public string EngineerType { get; set; } = string.Empty;
    public string Status { get; set; } = "Created";
    public DateTime? SubmittedAt { get; set; }
    public List<CreateIndentItemRequest> Items { get; set; } = new();
}

public class CreateIndentItemRequest
{
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialDesc { get; set; } = string.Empty;
    public string WorkType { get; set; } = string.Empty;
    public string ActivityId { get; set; } = string.Empty;
    public string LocationId { get; set; } = string.Empty;
    public string UoM { get; set; } = string.Empty;
    public decimal RequestedQty { get; set; }
    public string Remarks { get; set; } = string.Empty;
    public string AttachmentUrl { get; set; } = string.Empty;
}

public record CreateIndentResponse(string IndentId);

public class UpdateIndentStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
}
