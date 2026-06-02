using Newtonsoft.Json;
using System.Net.Http.Headers;
using System.Text;

namespace IndentMate.Mobile.Services;

/// <summary>
/// Handles all REST API communication with IndentMate.API backend.
/// </summary>
public class ApiService
{
    private readonly HttpClient _httpClient;
    private const string BaseUrl = "http://localhost:4000";

    public ApiService()
    {
        _httpClient = new HttpClient { BaseAddress = new Uri(BaseUrl) };
        _httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
    }

    /// <summary>Sets the JWT Bearer token for authenticated requests.</summary>
    public void SetAuthToken(string token)
    {
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
    }

    /// <summary>Clears the auth token on logout.</summary>
    public void ClearAuthToken()
    {
        _httpClient.DefaultRequestHeaders.Authorization = null;
    }

    /// <summary>Generic GET request. Returns deserialized object or default.</summary>
    public async Task<T?> GetAsync<T>(string endpoint, CancellationToken ct = default)
    {
        await ApplyStoredAuthTokenAsync();
        var response = await _httpClient.GetAsync(endpoint, ct);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        return JsonConvert.DeserializeObject<T>(json);
    }

    /// <summary>Generic POST request. Returns deserialized response or default.</summary>
    public async Task<TResponse?> PostAsync<TRequest, TResponse>(
        string endpoint, TRequest payload, CancellationToken ct = default)
    {
        await ApplyStoredAuthTokenAsync();
        var json = JsonConvert.SerializeObject(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(endpoint, content, ct);
        response.EnsureSuccessStatusCode();
        var responseJson = await response.Content.ReadAsStringAsync(ct);
        return JsonConvert.DeserializeObject<TResponse>(responseJson);
    }

    /// <summary>Generic PUT request.</summary>
    public async Task PutAsync<TRequest>(
        string endpoint, TRequest payload, CancellationToken ct = default)
    {
        await ApplyStoredAuthTokenAsync();
        var json = JsonConvert.SerializeObject(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PutAsync(endpoint, content, ct);
        response.EnsureSuccessStatusCode();
    }

    private async Task ApplyStoredAuthTokenAsync()
    {
        var token = await SecureStorage.Default.GetAsync("jwt_token");

        if (string.IsNullOrWhiteSpace(token))
        {
            ClearAuthToken();
            return;
        }

        SetAuthToken(token);
    }
}
