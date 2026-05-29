using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Services;
using System.Timers;

namespace IndentMate.Mobile.ViewModels;

public partial class LoginViewModel : BaseViewModel
{
    private const int PinLength = 6;
    private static readonly TimeSpan InactivityTimeout = TimeSpan.FromMinutes(5);
    private readonly System.Timers.Timer _inactivityTimer;

    [ObservableProperty] private string _engineerId = "Not configured";
    [ObservableProperty] private string _engineerName = "Engineer";
    [ObservableProperty] private string _company = "Company";
    [ObservableProperty] private string _pinInput = string.Empty;
    [ObservableProperty] private bool _pinDot1;
    [ObservableProperty] private bool _pinDot2;
    [ObservableProperty] private bool _pinDot3;
    [ObservableProperty] private bool _pinDot4;
    [ObservableProperty] private bool _pinDot5;
    [ObservableProperty] private bool _pinDot6;

    public LoginViewModel()
    {
        _inactivityTimer = new System.Timers.Timer(InactivityTimeout.TotalMilliseconds)
        {
            AutoReset = false
        };
        _inactivityTimer.Elapsed += OnInactivityTimerElapsed;

        _ = LoadEngineerInfoAsync();
    }

    public async Task LoadEngineerInfoAsync()
    {
        EngineerId = await SecureStorage.Default.GetAsync("engineer_id") ?? "Not configured";
        EngineerName = await SecureStorage.Default.GetAsync("engineer_name") ?? EngineerId;
        Company = await SecureStorage.Default.GetAsync("company") ?? "Company";
    }

    public void ResetInactivityTimer()
    {
        if (!_inactivityTimer.Enabled)
        {
            return;
        }

        _inactivityTimer.Stop();
        _inactivityTimer.Start();
    }

    [RelayCommand]
    private async Task LoginAsync()
    {
        await RunBusyAsync(async () =>
        {
            if (PinInput.Length != PinLength)
            {
                await ShowIncorrectPinAsync();
                return;
            }

            var storedHash = await SecureStorage.Default.GetAsync("pin_hash");
            var enteredHash = LNApiService.ComputeSHA256Hash(PinInput);

            if (!string.IsNullOrWhiteSpace(storedHash) &&
                string.Equals(enteredHash, storedHash, StringComparison.OrdinalIgnoreCase))
            {
                HasError = false;
                StatusMessage = string.Empty;
                await SecureStorage.Default.SetAsync("session_active", "true");
                _inactivityTimer.Start();
                await Shell.Current.GoToAsync("//home");
                return;
            }

            await ShowIncorrectPinAsync();
        });
    }

    [RelayCommand]
    private void AddDigit(string? digit)
    {
        if (string.IsNullOrWhiteSpace(digit) || PinInput.Length >= PinLength)
        {
            return;
        }

        PinInput += digit;
        ResetInactivityTimer();
    }

    [RelayCommand]
    private void Backspace()
    {
        if (PinInput.Length == 0)
        {
            return;
        }

        PinInput = PinInput[..^1];
        ResetInactivityTimer();
    }

    [RelayCommand]
    private async Task GoToSetupAsync()
    {
        await Shell.Current.GoToAsync("//setup");
    }

    public async Task LogoutAsync()
    {
        _inactivityTimer.Stop();
        SecureStorage.Default.Remove("session_active");
        PinInput = string.Empty;
        await Shell.Current.GoToAsync("//login");
    }

    partial void OnPinInputChanged(string value)
    {
        var cleaned = new string((value ?? string.Empty).Where(char.IsDigit).Take(PinLength).ToArray());
        if (cleaned != value)
        {
            PinInput = cleaned;
            return;
        }

        PinDot1 = cleaned.Length >= 1;
        PinDot2 = cleaned.Length >= 2;
        PinDot3 = cleaned.Length >= 3;
        PinDot4 = cleaned.Length >= 4;
        PinDot5 = cleaned.Length >= 5;
        PinDot6 = cleaned.Length >= 6;

        if (HasError)
        {
            HasError = false;
            StatusMessage = string.Empty;
        }
    }

    private async Task ShowIncorrectPinAsync()
    {
        HasError = true;
        StatusMessage = "Incorrect PIN";
        await Task.Delay(1000);
        PinInput = string.Empty;
    }

    private void OnInactivityTimerElapsed(object? sender, ElapsedEventArgs e)
    {
        MainThread.BeginInvokeOnMainThread(async () => await LogoutAsync());
    }
}
