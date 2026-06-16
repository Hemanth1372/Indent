namespace IndentMate.Mobile.Services;

public static class ApiEndpoints
{
#if ANDROID
    public const string BaseUrl = "https://indentmate.onrender.com";
#elif WINDOWS
    public const string BaseUrl = "https://indentmate.onrender.com";
#else
    public const string BaseUrl = "https://indentmate.onrender.com";
#endif
}
