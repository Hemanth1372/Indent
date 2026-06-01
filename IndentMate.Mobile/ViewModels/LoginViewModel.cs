using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Timers;

namespace IndentMate.Mobile.ViewModels;

public partial class LoginViewModel : BaseViewModel
{
    private const int PinLength = 6;
    private const string ApiBaseUrl = "http://localhost:4000";
    private const string HiddenRecentEngineersKey = "indentmate_hidden_recent_engineers";
    private static readonly TimeSpan InactivityTimeout = TimeSpan.FromMinutes(5);
    private readonly DatabaseService _databaseService;
    private readonly HttpClient _httpClient;
    private readonly System.Timers.Timer _inactivityTimer;
    private readonly SemaphoreSlim _loadLock = new(1, 1);

    [ObservableProperty] private string _engineerId = "Not configured";
    [ObservableProperty] private string _engineerName = "Engineer";
    [ObservableProperty] private string _company = "Company";
    [ObservableProperty] private LocalEngineer? _selectedEngineer;
    [ObservableProperty] private string _manualEngineerId = string.Empty;
    [ObservableProperty] private string _pinInput = string.Empty;
    [ObservableProperty] private bool _pinDot1;
    [ObservableProperty] private bool _pinDot2;
    [ObservableProperty] private bool _pinDot3;
    [ObservableProperty] private bool _pinDot4;
    [ObservableProperty] private bool _pinDot5;
    [ObservableProperty] private bool _pinDot6;

    public ObservableCollection<LocalEngineer> RecentEngineers { get; } = new();
    public bool HasRecentEngineers => RecentEngineers.Count > 0;
    public bool HasNoRecentEngineers => !HasRecentEngineers;
    public bool HasSelectedEngineer => SelectedEngineer is not null;
    public bool ShowManualEngineerEntry => SelectedEngineer is null;
    public string SelectedInitials => BuildInitials(EngineerName);

    public LoginViewModel()
    {
        _databaseService = new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db"));
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(ApiBaseUrl),
            Timeout = TimeSpan.FromSeconds(15)
        };
        _inactivityTimer = new System.Timers.Timer(InactivityTimeout.TotalMilliseconds)
        {
            AutoReset = false
        };
        _inactivityTimer.Elapsed += OnInactivityTimerElapsed;
    }

    public async Task LoadEngineerInfoAsync()
    {
        await _loadLock.WaitAsync();
        try
        {
            Company = await SecureStorage.Default.GetAsync("company") ?? "Company";
            await LoadRecentEngineersAsync();

            var configuredEngineerId = NormalizeEngineerId(await SecureStorage.Default.GetAsync("engineer_id"));
            var preferredEngineer = !string.IsNullOrWhiteSpace(configuredEngineerId)
                ? RecentEngineers.FirstOrDefault(engineer =>
                    string.Equals(NormalizeEngineerId(engineer.EngineerId), configuredEngineerId, StringComparison.OrdinalIgnoreCase))
                : null;

            SelectedEngineer = preferredEngineer ?? RecentEngineers.FirstOrDefault();

            if (SelectedEngineer is null)
            {
                EngineerId = string.IsNullOrWhiteSpace(configuredEngineerId) ? "Not configured" : configuredEngineerId;
                EngineerName = await SecureStorage.Default.GetAsync("engineer_name") ?? EngineerId;
                ManualEngineerId = configuredEngineerId ?? string.Empty;
                OnPropertyChanged(nameof(SelectedInitials));
                return;
            }

            ApplySelectedEngineer(SelectedEngineer);
        }
        finally
        {
            _loadLock.Release();
        }
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
            var activeEngineerId = NormalizeEngineerId(SelectedEngineer?.EngineerId ?? ManualEngineerId);
            if (string.IsNullOrWhiteSpace(activeEngineerId))
            {
                HasError = true;
                StatusMessage = "Please select or enter a User ID.";
                return;
            }

            if (PinInput.Length == 0)
            {
                HasError = true;
                StatusMessage = "Please enter your PIN.";
                return;
            }

            var storedHash = await SecureStorage.Default.GetAsync("pin_hash");
            var selectedEngineer = SelectedEngineer;
            var manualEngineer = selectedEngineer is null
                ? await _databaseService.GetEngineerAsync(activeEngineerId)
                : null;
            var configuredEngineerId = NormalizeEngineerId(await SecureStorage.Default.GetAsync("engineer_id"));
            var isLocalLoginCandidate = selectedEngineer is not null || manualEngineer is not null;

            if (selectedEngineer is not null)
            {
                storedHash = selectedEngineer.PinHash;
            }
            else if (manualEngineer is not null)
            {
                storedHash = manualEngineer.PinHash;
            }
            else if (string.Equals(configuredEngineerId, activeEngineerId, StringComparison.OrdinalIgnoreCase))
            {
                isLocalLoginCandidate = true;
            }

            var enteredHash = LNApiService.ComputeSHA256Hash(PinInput);

            if (isLocalLoginCandidate &&
                !string.IsNullOrWhiteSpace(storedHash) &&
                string.Equals(enteredHash, storedHash, StringComparison.OrdinalIgnoreCase))
            {
                var authenticatedEngineer = await AuthenticateManualUserAsync(activeEngineerId, PinInput);

                if (authenticatedEngineer is null)
                {
                    if (HasError)
                    {
                        return;
                    }

                    await ShowIncorrectPinAsync(activeEngineerId);
                    return;
                }

                await CompleteLoginAsync(authenticatedEngineer);
                return;
            }

            if (selectedEngineer is null)
            {
                var backendEngineer = await AuthenticateManualUserAsync(activeEngineerId, PinInput);
                if (backendEngineer is not null)
                {
                    await CompleteLoginAsync(backendEngineer);
                    return;
                }

                if (HasError)
                {
                    return;
                }
            }

            await ShowIncorrectPinAsync(activeEngineerId);
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

    [RelayCommand]
    private void SelectEngineer(LocalEngineer? engineer)
    {
        if (engineer is null)
        {
            return;
        }

        SelectedEngineer = engineer;
        ApplySelectedEngineer(engineer);
        ManualEngineerId = string.Empty;
        PinInput = string.Empty;
        HasError = false;
        StatusMessage = string.Empty;
    }

    [RelayCommand]
    private void LoginAsDifferentUser()
    {
        SelectedEngineer = null;
        ManualEngineerId = string.Empty;
        PinInput = string.Empty;
        HasError = false;
        StatusMessage = string.Empty;
        EngineerId = "Not configured";
        EngineerName = "Engineer";
        OnPropertyChanged(nameof(SelectedInitials));
    }

    [RelayCommand]
    private async Task RemoveEngineerAsync(LocalEngineer? engineer)
    {
        if (engineer is null)
        {
            return;
        }

        HideRecentEngineer(engineer.EngineerId);
        RecentEngineers.Remove(engineer);

        if (string.Equals(NormalizeEngineerId(SelectedEngineer?.EngineerId), NormalizeEngineerId(engineer.EngineerId), StringComparison.OrdinalIgnoreCase))
        {
            SelectedEngineer = RecentEngineers.FirstOrDefault();
            PinInput = string.Empty;
            HasError = false;
            StatusMessage = string.Empty;

            if (SelectedEngineer is null)
            {
                EngineerId = "Not configured";
                EngineerName = "Engineer";
                Company = "Company";
                ManualEngineerId = string.Empty;
                OnPropertyChanged(nameof(SelectedInitials));
            }
            else
            {
                ApplySelectedEngineer(SelectedEngineer);
            }
        }

        OnPropertyChanged(nameof(HasRecentEngineers));
        OnPropertyChanged(nameof(HasNoRecentEngineers));
    }

    partial void OnSelectedEngineerChanged(LocalEngineer? value)
    {
        OnPropertyChanged(nameof(HasSelectedEngineer));
        OnPropertyChanged(nameof(ShowManualEngineerEntry));
    }

    partial void OnManualEngineerIdChanged(string value)
    {
        if (HasError)
        {
            HasError = false;
            StatusMessage = string.Empty;
        }
    }

    [RelayCommand]
    private async Task ForgotPinAsync()
    {
        var accountName = SelectedEngineer?.Name ?? EngineerName;
        await Shell.Current.DisplayAlert(
            "Security Notice",
            $"PIN resets must be authorized by a System Administrator.\n\nPlease contact your Admin to reset the PIN for {accountName}.",
            "OK");
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

    private async Task ShowIncorrectPinAsync(string engineerId)
    {
        HasError = true;
        StatusMessage = $"Incorrect credentials for ID: {engineerId}";
        await Task.Delay(1000);
        PinInput = string.Empty;
    }

    private async Task<LocalEngineer?> AuthenticateManualUserAsync(string engineerId, string password)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync("/api/auth/login", new
            {
                login_name = engineerId,
                password
            });

            if (!response.IsSuccessStatusCode)
            {
                await HandleFailedBackendLoginAsync(response, engineerId);
                return null;
            }

            var loginResponse = await response.Content.ReadFromJsonAsync<LoginApiResponse>();
            if (loginResponse?.Token is null || loginResponse.User is null)
            {
                return null;
            }

            var loginName = NormalizeEngineerId(loginResponse.User.LoginName ?? engineerId);
            var responseName = loginResponse.User.EmployeeName ?? loginResponse.User.Name;
            var employeeName = string.IsNullOrWhiteSpace(responseName)
                ? loginName
                : responseName.Trim();

            await SecureStorage.Default.SetAsync("jwt_token", loginResponse.Token);

            return new LocalEngineer
            {
                EngineerId = loginName,
                Name = employeeName,
                Company = await SecureStorage.Default.GetAsync("company") ?? Company,
                PinHash = LNApiService.ComputeSHA256Hash(password),
                LNEnvironment = await SecureStorage.Default.GetAsync("ln_environment") ?? string.Empty,
                ResponsibilityCode = string.IsNullOrWhiteSpace(loginResponse.User.PrimaryRole)
                    ? (loginName.StartsWith("SER", StringComparison.OrdinalIgnoreCase) ? "SER" : "SIE")
                    : loginResponse.User.PrimaryRole,
                LastSyncAt = DateTime.UtcNow
            };
        }
        catch
        {
            HasError = true;
            StatusMessage = "Connection error. Is the backend running?";
            return null;
        }
    }

    private async Task HandleFailedBackendLoginAsync(HttpResponseMessage response, string engineerId)
    {
        LoginApiError? loginError = null;

        try
        {
            loginError = await response.Content.ReadFromJsonAsync<LoginApiError>();
        }
        catch
        {
            // Fall back to the generic credential message below.
        }

        if (response.StatusCode == System.Net.HttpStatusCode.Forbidden &&
            string.Equals(loginError?.ErrorCode, "ACCOUNT_DEACTIVATED", StringComparison.OrdinalIgnoreCase))
        {
            await PurgeDeactivatedEngineerAsync(engineerId);
            HasError = true;
            StatusMessage = "User is deactivated, or no longer in use.";
            return;
        }

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound &&
            string.Equals(loginError?.ErrorCode, "LOGIN_ID_NOT_FOUND", StringComparison.OrdinalIgnoreCase))
        {
            await PurgeDeactivatedEngineerAsync(engineerId);
            HasError = true;
            StatusMessage = "No login ID found.";
        }
    }

    private async Task PurgeDeactivatedEngineerAsync(string engineerId)
    {
        var normalizedEngineerId = NormalizeEngineerId(engineerId);

        if (string.IsNullOrWhiteSpace(normalizedEngineerId))
        {
            return;
        }

        HideRecentEngineer(normalizedEngineerId);
        await _databaseService.DeleteEngineerAsync(normalizedEngineerId);

        var matchingEngineers = RecentEngineers
            .Where(engineer => string.Equals(
                NormalizeEngineerId(engineer.EngineerId),
                normalizedEngineerId,
                StringComparison.OrdinalIgnoreCase))
            .ToList();

        foreach (var engineer in matchingEngineers)
        {
            RecentEngineers.Remove(engineer);
        }

        if (string.Equals(
            NormalizeEngineerId(await SecureStorage.Default.GetAsync("engineer_id")),
            normalizedEngineerId,
            StringComparison.OrdinalIgnoreCase))
        {
            SecureStorage.Default.Remove("engineer_id");
            SecureStorage.Default.Remove("engineer_name");
            SecureStorage.Default.Remove("pin_hash");
            SecureStorage.Default.Remove("jwt_token");
            SecureStorage.Default.Remove("session_active");
        }

        if (string.Equals(
            NormalizeEngineerId(SelectedEngineer?.EngineerId),
            normalizedEngineerId,
            StringComparison.OrdinalIgnoreCase))
        {
            SelectedEngineer = null;
            EngineerId = "Not configured";
            EngineerName = "Engineer";
            ManualEngineerId = string.Empty;
            OnPropertyChanged(nameof(SelectedInitials));
        }

        PinInput = string.Empty;
        OnPropertyChanged(nameof(HasRecentEngineers));
        OnPropertyChanged(nameof(HasNoRecentEngineers));
    }

    private async Task<LocalEngineer?> BuildEngineerFromSecureStorageAsync(string engineerId, string? pinHash)
    {
        if (string.IsNullOrWhiteSpace(pinHash))
        {
            return null;
        }

        return new LocalEngineer
        {
            EngineerId = engineerId,
            Name = await SecureStorage.Default.GetAsync("engineer_name") ?? engineerId,
            Company = await SecureStorage.Default.GetAsync("company") ?? Company,
            PinHash = pinHash,
            LNEnvironment = await SecureStorage.Default.GetAsync("ln_environment") ?? string.Empty,
            ResponsibilityCode = engineerId.StartsWith("SER", StringComparison.OrdinalIgnoreCase)
                ? "SER"
                : "SIE",
            LastSyncAt = DateTime.UtcNow
        };
    }

    private async Task CompleteLoginAsync(LocalEngineer? authenticatedEngineer)
    {
        if (authenticatedEngineer is not null)
        {
            authenticatedEngineer.EngineerId = NormalizeEngineerId(authenticatedEngineer.EngineerId);
            authenticatedEngineer.LastSyncAt = DateTime.UtcNow;
            await _databaseService.SaveAsync(authenticatedEngineer);
            UnhideRecentEngineer(authenticatedEngineer.EngineerId);
            await SecureStorage.Default.SetAsync("engineer_id", authenticatedEngineer.EngineerId);
            await SecureStorage.Default.SetAsync("engineer_name", authenticatedEngineer.Name);
            await SecureStorage.Default.SetAsync("company", authenticatedEngineer.Company);
            await SecureStorage.Default.SetAsync("pin_hash", authenticatedEngineer.PinHash);
            SelectedEngineer = authenticatedEngineer;
            ManualEngineerId = string.Empty;
            await LoadRecentEngineersAsync();
        }

        HasError = false;
        StatusMessage = string.Empty;
        await SecureStorage.Default.SetAsync("session_active", "true");
        _inactivityTimer.Start();
        await Shell.Current.GoToAsync("//home");
    }

    private async Task LoadRecentEngineersAsync()
    {
        RecentEngineers.Clear();
        var engineers = await _databaseService.GetRecentEngineersAsync(5);
        var normalizedEngineers = new List<LocalEngineer>();
        var hiddenEngineerIds = ReadHiddenRecentEngineers();

        foreach (var group in engineers
            .Where(engineer => !string.IsNullOrWhiteSpace(engineer.EngineerId))
            .GroupBy(engineer => NormalizeEngineerId(engineer.EngineerId), StringComparer.OrdinalIgnoreCase))
        {
            var normalizedEngineerId = group.Key;
            var keeper = group
                .OrderByDescending(engineer => engineer.LastSyncAt ?? DateTime.MinValue)
                .First();

            foreach (var duplicate in group.Where(engineer => !ReferenceEquals(engineer, keeper)))
            {
                await _databaseService.DeleteEngineerAsync(duplicate.EngineerId);
            }

            if (!string.Equals(keeper.EngineerId, normalizedEngineerId, StringComparison.Ordinal))
            {
                await _databaseService.DeleteEngineerAsync(keeper.EngineerId);
                keeper.EngineerId = normalizedEngineerId;
                await _databaseService.SaveAsync(keeper);
            }

            if (!hiddenEngineerIds.Contains(normalizedEngineerId))
            {
                normalizedEngineers.Add(keeper);
            }
        }

        RecentEngineers.Clear();

        foreach (var engineer in normalizedEngineers
            .OrderByDescending(engineer => engineer.LastSyncAt ?? DateTime.MinValue)
            .Take(5))
        {
            RecentEngineers.Add(engineer);
        }

        OnPropertyChanged(nameof(HasRecentEngineers));
        OnPropertyChanged(nameof(HasNoRecentEngineers));
    }

    private void ApplySelectedEngineer(LocalEngineer engineer)
    {
        EngineerId = NormalizeEngineerId(engineer.EngineerId);
        EngineerName = string.IsNullOrWhiteSpace(engineer.Name) ? engineer.EngineerId : engineer.Name;
        Company = string.IsNullOrWhiteSpace(engineer.Company) ? Company : engineer.Company;
        OnPropertyChanged(nameof(SelectedInitials));
    }

    private static string NormalizeEngineerId(string? engineerId)
    {
        return (engineerId ?? string.Empty).Trim();
    }

    private static HashSet<string> ReadHiddenRecentEngineers()
    {
        var hiddenJson = Preferences.Default.Get(HiddenRecentEngineersKey, "[]");

        try
        {
            return JsonSerializer
                .Deserialize<List<string>>(hiddenJson)?
                .Select(NormalizeEngineerId)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .ToHashSet(StringComparer.OrdinalIgnoreCase) ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            Preferences.Default.Remove(HiddenRecentEngineersKey);
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private static void SaveHiddenRecentEngineers(HashSet<string> hiddenEngineerIds)
    {
        Preferences.Default.Set(HiddenRecentEngineersKey, JsonSerializer.Serialize(hiddenEngineerIds.ToList()));
    }

    private static void HideRecentEngineer(string engineerId)
    {
        var hiddenEngineerIds = ReadHiddenRecentEngineers();
        var normalizedEngineerId = NormalizeEngineerId(engineerId);

        if (string.IsNullOrWhiteSpace(normalizedEngineerId))
        {
            return;
        }

        hiddenEngineerIds.Add(normalizedEngineerId);
        SaveHiddenRecentEngineers(hiddenEngineerIds);
    }

    private static void UnhideRecentEngineer(string engineerId)
    {
        var hiddenEngineerIds = ReadHiddenRecentEngineers();
        var normalizedEngineerId = NormalizeEngineerId(engineerId);

        if (hiddenEngineerIds.Remove(normalizedEngineerId))
        {
            SaveHiddenRecentEngineers(hiddenEngineerIds);
        }
    }

    private sealed class LoginApiResponse
    {
        [JsonPropertyName("token")]
        public string? Token { get; set; }

        [JsonPropertyName("user")]
        public LoginApiUser? User { get; set; }
    }

    private sealed class LoginApiUser
    {
        [JsonPropertyName("login_name")]
        public string? LoginName { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("employee_name")]
        public string? EmployeeName { get; set; }

        [JsonPropertyName("primary_role")]
        public string? PrimaryRole { get; set; }
    }

    private sealed class LoginApiError
    {
        [JsonPropertyName("errorCode")]
        public string? ErrorCode { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }

    private static string BuildInitials(string value)
    {
        var parts = (value ?? string.Empty)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length == 0)
        {
            return "IM";
        }

        if (parts.Length == 1)
        {
            return parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant();
        }

        return $"{parts[0][0]}{parts[^1][0]}".ToUpperInvariant();
    }

    private void OnInactivityTimerElapsed(object? sender, ElapsedEventArgs e)
    {
        MainThread.BeginInvokeOnMainThread(async () => await LogoutAsync());
    }
}
