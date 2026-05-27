using IndentMate.Shared.Entities;
using Microsoft.EntityFrameworkCore;

namespace IndentMate.API.Data;

/// <summary>
/// Primary EF Core DbContext for IndentMate backend (SQL Server).
/// Manages all server-side tables with Fluent API configuration.
/// </summary>
public class IndentMateDbContext : DbContext
{
    public IndentMateDbContext(DbContextOptions<IndentMateDbContext> options)
        : base(options) { }

    // ─── DbSets ──────────────────────────────────────────────────────────────
    public DbSet<Engineer>    Engineers    { get; set; }
    public DbSet<Project>     Projects     { get; set; }
    public DbSet<Indent>      Indents      { get; set; }
    public DbSet<IndentItem>  IndentItems  { get; set; }
    public DbSet<Warehouse>   Warehouses   { get; set; }
    public DbSet<Item>        Items        { get; set; }
    public DbSet<SyncLog>     SyncLogs     { get; set; }
    public DbSet<OfflineQueue> OfflineQueues { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ─── Engineer ────────────────────────────────────────────────────────
        modelBuilder.Entity<Engineer>(e =>
        {
            e.ToTable("Engineers");
            e.HasKey(x => x.EngineerId);
            e.HasIndex(x => x.ResponsibilityCode);
            e.Property(x => x.PinHash).IsRequired();
        });

        // ─── Project ─────────────────────────────────────────────────────────
        modelBuilder.Entity<Project>(e =>
        {
            e.ToTable("Projects");
            e.HasKey(x => x.ProjectId);
            e.HasIndex(x => x.SiteCode);
        });

        // ─── Indent ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Indent>(e =>
        {
            e.ToTable("Indents");
            e.HasKey(x => x.IndentId);
            e.Property(x => x.IndentId).HasDefaultValueSql("NEWID()");

            e.HasIndex(x => x.EngineerId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.CreatedAt);

            // FK: Engineer → Indent (restrict delete to protect audit trail)
            e.HasOne(x => x.Engineer)
             .WithMany(x => x.Indents)
             .HasForeignKey(x => x.EngineerId)
             .OnDelete(DeleteBehavior.Restrict);

            // FK: Project → Indent
            e.HasOne(x => x.Project)
             .WithMany(x => x.Indents)
             .HasForeignKey(x => x.ProjectId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── IndentItem ──────────────────────────────────────────────────────
        modelBuilder.Entity<IndentItem>(e =>
        {
            e.ToTable("IndentItems");
            e.HasKey(x => x.ItemLineId);
            e.Property(x => x.ItemLineId).HasDefaultValueSql("NEWID()");
            e.Property(x => x.RequestedQty).HasColumnType("decimal(18,4)");

            // FK: Indent → IndentItem (cascade delete items with their indent)
            e.HasOne(x => x.Indent)
             .WithMany(x => x.Items)
             .HasForeignKey(x => x.IndentId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── Warehouse ───────────────────────────────────────────────────────
        modelBuilder.Entity<Warehouse>(e =>
        {
            e.ToTable("Warehouses");
            e.HasKey(x => x.WarehouseCode);
            e.HasIndex(x => x.SiteCode);
            e.HasIndex(x => x.IsMaterialWH);
        });

        // ─── Item ────────────────────────────────────────────────────────────
        modelBuilder.Entity<Item>(e =>
        {
            e.ToTable("Items");
            e.HasKey(x => x.ItemCode);
            e.Property(x => x.OnHandQty).HasColumnType("decimal(18,4)");
            e.HasIndex(x => x.ItemGroup);
            e.HasIndex(x => x.SiteCode);
        });

        // ─── SyncLog ─────────────────────────────────────────────────────────
        modelBuilder.Entity<SyncLog>(e =>
        {
            e.ToTable("SyncLogs");
            e.HasKey(x => x.SyncId);
            e.Property(x => x.SyncId).HasDefaultValueSql("NEWID()");

            e.HasOne(x => x.Engineer)
             .WithMany(x => x.SyncLogs)
             .HasForeignKey(x => x.EngineerId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── OfflineQueue ────────────────────────────────────────────────────
        modelBuilder.Entity<OfflineQueue>(e =>
        {
            e.ToTable("OfflineQueue");
            e.HasKey(x => x.QueueId);
            e.Property(x => x.QueueId).HasDefaultValueSql("NEWID()");
            e.Property(x => x.PayloadJson).HasColumnType("nvarchar(max)");

            e.HasOne(x => x.Engineer)
             .WithMany(x => x.OfflineQueues)
             .HasForeignKey(x => x.EngineerId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ─── Seed Data ───────────────────────────────────────────────────────
        SeedData(modelBuilder);
    }

    private static void SeedData(ModelBuilder modelBuilder)
    {
        // Test engineer for development/testing
        modelBuilder.Entity<Engineer>().HasData(new Engineer
        {
            EngineerId       = "ENG001",
            Name             = "Test Engineer",
            // SHA-256 hash of "123456" — replace with BCrypt in production
            PinHash          = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
            LNEnvironment    = "TST",
            Company          = "100",
            ResponsibilityCode = "SIE",
            ValidTo          = null,
            LastSyncAt       = null
        });
    }
}
