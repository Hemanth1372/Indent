using Microsoft.Extensions.DependencyInjection;

using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;

namespace IndentMate.Mobile;

public partial class App : Application
{
    private readonly SyncService _syncService;

	public App()
	{
		InitializeComponent();

        var databaseService = new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db"));
        _syncService = new SyncService(databaseService, new ApiService(), new LNApiService());
        _syncService.StartPendingSyncMonitor();
	}

	protected override Window CreateWindow(IActivationState? activationState)
	{
		return new Window(new AppShell());
	}
}
