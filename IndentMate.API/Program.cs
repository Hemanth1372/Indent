using IndentMate.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ─── Controllers ──────────────────────────────────────────────────────────────
builder.Services.AddControllers();

// ─── EF Core — SQL Server ─────────────────────────────────────────────────────
builder.Services.AddDbContext<IndentMateDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions => sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorNumbersToAdd: null)));


// ─── OpenAPI / Swagger ────────────────────────────────────────────────────────
// Using built-in .NET OpenAPI (no Swashbuckle for .NET 10 compatibility)
builder.Services.AddOpenApi();

// ─── CORS — allow React dev server on localhost:5173 ─────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactDevPolicy", policy =>
        policy.WithOrigins("http://localhost:5173", "https://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// ─── JWT Bearer Authentication ────────────────────────────────────────────────
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"] ?? "PLACEHOLDER_SECRET_REPLACE_IN_PRODUCTION_32CHARS";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwtSettings["Issuer"]   ?? "IndentMateAPI",
            ValidAudience            = jwtSettings["Audience"] ?? "IndentMateMobile",
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
        };
    });

builder.Services.AddAuthorization();

// ─── Health Checks ─────────────────────────────────────────────────────────────
builder.Services.AddHealthChecks()
    .AddSqlServer(
        connectionString: builder.Configuration.GetConnectionString("DefaultConnection") ?? string.Empty,
        name: "sqlserver",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Degraded);

// ─── Build & Pipeline ─────────────────────────────────────────────────────────
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Built-in OpenAPI endpoint at /openapi/v1.json
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("ReactDevPolicy");
app.UseAuthentication();
app.UseAuthorization();

// Health check at GET /health
app.MapHealthChecks("/health");
app.MapControllers();

app.Run();
