namespace IndentMate.Mobile.Services;

public static class ApiEndpoints
{
#if ANDROID
    public const string BaseUrl = "https://indentmate-ofk6.onrender.com";
#elif WINDOWS
    public const string BaseUrl = "http://localhost:4000";
#else
    public const string BaseUrl = "http://localhost:4000";
#endif
}
