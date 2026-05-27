using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Shared.Models;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class IndentHeaderViewModel : BaseViewModel
{
    // Engineer type
    public List<string> EngineerTypes { get; } = new() { "SIE", "SER" };
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsSIE), nameof(IsSER))]
    private string _selectedEngineerType = "SIE";

    public bool IsSIE => SelectedEngineerType == "SIE";
    public bool IsSER => SelectedEngineerType == "SER";

    // Projects
    public ObservableCollection<ProjectModel> Projects { get; } = new();
    [ObservableProperty] private ProjectModel? _selectedProject;

    // SIE fields
    public List<string> IndentTypes { get; } = new() { "Issue", "Issue Return" };
    [ObservableProperty] private string _selectedIndentType = "Issue";
    public ObservableCollection<WarehouseModel> Warehouses { get; } = new();
    [ObservableProperty] private WarehouseModel? _selectedWarehouse;
    public ObservableCollection<LocationModel> FromLocations { get; } = new();
    [ObservableProperty] private LocationModel? _selectedFromLocation;

    // SER fields
    public ObservableCollection<ServiceOrderModel> ServiceOrders { get; } = new();
    [ObservableProperty] private ServiceOrderModel? _selectedServiceOrder;
    [ObservableProperty] private string _equipmentDisplay = string.Empty;

    public IndentHeaderViewModel()
    {
        LoadMasterDataAsync().ConfigureAwait(false);
    }

    [RelayCommand]
    private async Task LoadMasterDataAsync()
    {
        await RunBusyAsync(async () =>
        {
            // TODO: Load projects, warehouses, locations, service orders from AppDatabase (SQLite)
            await Task.Delay(200);
        });
    }

    [RelayCommand]
    private async Task CreateRequestAsync()
    {
        await RunBusyAsync(async () =>
        {
            if (SelectedProject is null)
                throw new InvalidOperationException("Please select a project.");

            // TODO: Create Indent record in SQLite with Created status
            // TODO: Pass indent ID to IndentDetailsPage
            await Shell.Current.GoToAsync("indent-details");
        });
    }
}
