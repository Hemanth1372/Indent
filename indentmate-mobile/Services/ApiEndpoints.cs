namespace IndentMate.Mobile.Services;

public static class ApiEndpoints
{
    private const string ActiveBaseUrlKey = "indentmate_active_api_base_url";

#if ANDROID
    public const string BaseUrl = "http://10.0.2.2:4000";
#else
    public const string BaseUrl = "http://localhost:4000";
#endif

    public static IReadOnlyList<string> CandidateBaseUrls { get; } =
    [
        BaseUrl,
#if ANDROID
        "http://localhost:4000"
#else
        "http://127.0.0.1:4000"
#endif
    ];

    public static string CurrentBaseUrl
    {
        get
        {
            var activeBaseUrl = Preferences.Default.Get(ActiveBaseUrlKey, BaseUrl);
            return CandidateBaseUrls.Contains(activeBaseUrl, StringComparer.OrdinalIgnoreCase)
                ? activeBaseUrl
                : BaseUrl;
        }
    }

    public static void SetActiveBaseUrl(string baseUrl)
    {
        var normalizedBaseUrl = (baseUrl ?? string.Empty).Trim().TrimEnd('/');
        if (CandidateBaseUrls.Contains(normalizedBaseUrl, StringComparer.OrdinalIgnoreCase))
        {
            Preferences.Default.Set(ActiveBaseUrlKey, normalizedBaseUrl);
        }
    }
}
