using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Maui.Hosting;

namespace IndentMate.Mobile;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();

        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
                fonts.AddFont("MaterialIcons-Regular.ttf", "MaterialIcons");
            });

        // ─── Register SQLite DatabaseService ──────────────────────────────────
        var dbPath = Path.Combine(FileSystem.AppDataDirectory, "indentmate.db");
        var databaseService = new DatabaseService(dbPath);
        // Initialize tables eagerly at startup (non-blocking background)
        Task.Run(async () => await databaseService.InitAsync());
        builder.Services.AddSingleton(databaseService);


        // ─── Register Services ────────────────────────────────────────────────
        builder.Services.AddSingleton<ApiService>();
        builder.Services.AddSingleton<AuthService>();
        builder.Services.AddSingleton<SyncService>();
        builder.Services.AddSingleton<LNApiService>();

        // ─── Register Views ───────────────────────────────────────────────────
        builder.Services.AddTransient<Views.SetupPage>();
        builder.Services.AddTransient<Views.LoginPage>();
        builder.Services.AddTransient<Views.LoginSuccessPage>();
        builder.Services.AddTransient<Views.HomePage>();
        builder.Services.AddTransient<Views.IndentHomePage>();
        builder.Services.AddTransient<Views.IndentHeaderPage>();
        builder.Services.AddTransient<Views.SIEIndentHeaderPage>();
        builder.Services.AddTransient<Views.SERIndentHeaderPage>();
        builder.Services.AddTransient<Views.IndentDetailsPage>();
        builder.Services.AddTransient<Views.AddItemPage>();
        builder.Services.AddTransient<Views.AddItemSERPage>();

        // ─── Register ViewModels ──────────────────────────────────────────────
        builder.Services.AddTransient<ViewModels.SetupViewModel>();
        builder.Services.AddTransient<ViewModels.LoginViewModel>();
        builder.Services.AddTransient<ViewModels.LoginSuccessViewModel>();
        builder.Services.AddTransient<ViewModels.HomeViewModel>();
        builder.Services.AddTransient<ViewModels.IndentHomeViewModel>();
        builder.Services.AddTransient<ViewModels.IndentHeaderViewModel>();
        builder.Services.AddTransient<ViewModels.SIEIndentHeaderViewModel>();
        builder.Services.AddTransient<ViewModels.SERIndentHeaderViewModel>();
        builder.Services.AddTransient<ViewModels.IndentDetailsViewModel>();
        builder.Services.AddTransient<ViewModels.AddItemViewModel>();
        builder.Services.AddTransient<ViewModels.AddItemSERViewModel>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
