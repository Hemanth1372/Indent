using Microsoft.AspNetCore.Mvc;

namespace IndentMate.API.Controllers;

/// <summary>
/// Health check controller (manual endpoint in addition to the built-in /health).
/// Returns API status, version, and timestamp.
/// </summary>
[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet("/health")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetHealth()
    {
        return Ok(new
        {
            Status = "Healthy",
            Version = "1.0.0",
            Timestamp = DateTime.UtcNow,
            Service = "IndentMate API"
        });
    }
}
