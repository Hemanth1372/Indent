using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace IndentMate.Mobile.ViewModels;

public partial class LoginViewModel : BaseViewModel
{
    private const int PinLength = 6;
    private const int MaxFailedLoginAttempts = 4;
    private const int LoginLockoutSeconds = 30;
    private const string BackendConnectionErrorMessage = "Connection error. Is the backend running?";
    private const string HiddenRecentEngineersKey = "indentmate_hidden_recent_engineers";
    private readonly DatabaseService _databaseService;
    private readonly HttpClient _httpClient;
    private readonly SemaphoreSlim _loadLock = new(1, 1);
    private int _failedLoginAttempts;
    private bool _isAutoLoginQueued;
    private CancellationTokenSource? _lockoutCancellationTokenSource;

    [ObservableProperty] private string _engineerId = "Not configured";
    [ObservableProperty] private string _engineerName = "Engineer";
    [ObservableProperty] private string _company = "Company";
    [ObservableProperty] private LocalEngineer? _selectedEngineer;
    [ObservableProperty] private string _manualEngineerId = string.Empty;
    [ObservableProperty] private string _pinInput = string.Empty;
    [ObservableProperty] private bool _isPinVisible;
    [ObservableProperty] private bool _isLoginLockedOut;
    [ObservableProperty] private int _lockoutSecondsRemaining;
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
    public bool IsPinHidden => !IsPinVisible;
    public bool IsPinEntryEnabled => !IsLoginLockedOut;
    public bool HasPinInput => PinInput.Length > 0;
    public bool ShowPinPlaceholder => PinInput.Length == 0;
    public string PinChar1 => GetPinCharacter(0);
    public string PinChar2 => GetPinCharacter(1);
    public string PinChar3 => GetPinCharacter(2);
    public string PinChar4 => GetPinCharacter(3);
    public string PinChar5 => GetPinCharacter(4);
    public string PinChar6 => GetPinCharacter(5);

    public LoginViewModel()
    {
        _databaseService = new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db"));
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(ApiEndpoints.CurrentBaseUrl),
            Timeout = TimeSpan.FromSeconds(15)
        };
    }

    public async Task LoadEngineerInfoAsync()
    {
        await _loadLock.WaitAsync();
        try
        {
            Company = await SecureStorage.Default.GetAsync("company") ?? "Company";
            var configuredEngineerId = NormalizeEngineerId(await SecureStorage.Default.GetAsync("engineer_id"));
            var storedEngineerName = await SecureStorage.Default.GetAsync("engineer_name");

            RecentEngineers.Clear();
            ManualEngineerId = string.Empty;
            EngineerId = string.IsNullOrWhiteSpace(configuredEngineerId) ? "Not configured" : configuredEngineerId;
            SelectedEngineer = string.IsNullOrWhiteSpace(configuredEngineerId)
                ? null
                : await _databaseService.GetEngineerAsync(configuredEngineerId);

            if (SelectedEngineer is null)
            {
                EngineerName = string.IsNullOrWhiteSpace(storedEngineerName) ? EngineerId : storedEngineerName.Trim();
                OnPropertyChanged(nameof(SelectedInitials));
                OnPropertyChanged(nameof(HasRecentEngineers));
                OnPropertyChanged(nameof(HasNoRecentEngineers));
                return;
            }

            ApplySelectedEngineer(SelectedEngineer);
            OnPropertyChanged(nameof(HasRecentEngineers));
            OnPropertyChanged(nameof(HasNoRecentEngineers));
        }
        finally
        {
            _loadLock.Release();
        }
    }

    public void ResetInactivityTimer()
    {
    }

    [RelayCommand]
    private async Task LoginAsync()
    {
        await RunBusyAsync(async () =>
        {
            _isAutoLoginQueued = false;

            if (IsLoginLockedOut)
            {
                return;
            }

            var configuredEngineerId = NormalizeEngineerId(await SecureStorage.Default.GetAsync("engineer_id"));
            var activeEngineerId = NormalizeEngineerId(string.IsNullOrWhiteSpace(configuredEngineerId) ? EngineerId : configuredEngineerId);
            if (string.IsNullOrWhiteSpace(activeEngineerId))
            {
                HasError = true;
                StatusMessage = "Employee ID is not configured. Please complete setup.";
                return;
            }

            if (PinInput.Length == 0)
            {
                HasError = true;
                StatusMessage = "Please enter your PIN.";
                return;
            }

            SecureStorage.Default.Remove("jwt_token");
            var storedHash = await SecureStorage.Default.GetAsync("pin_hash");
            var selectedEngineer = SelectedEngineer;
            var manualEngineer = selectedEngineer is null
                ? await _databaseService.GetEngineerAsync(activeEngineerId)
                : null;
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

                if (authenticatedEngineer is not null)
                {
                    await CompleteLoginAsync(authenticatedEngineer);
                    return;
                }

                if (HasError)
                {
                    if (!IsBackendConnectionError(StatusMessage))
                    {
                        return;
                    }

                    var offlineEngineer = selectedEngineer ??
                        manualEngineer ??
                        await BuildEngineerFromSecureStorageAsync(activeEngineerId, storedHash);

                    if (offlineEngineer is not null)
                    {
                        if (IsProjectInchargeRole(offlineEngineer.ResponsibilityCode) && !await HasBackendTokenAsync())
                        {
                            HasError = true;
                            StatusMessage = "Project Incharge login needs online backend verification. Please check internet access and try again.";
                            PinInput = string.Empty;
                            return;
                        }

                        await CompleteLoginAsync(offlineEngineer);
                        return;
                    }

                    HasError = true;
                    StatusMessage = "Access Denied: No valid SIE/SER/Project Incharge role assigned to this user.";
                    PinInput = string.Empty;
                    return;
                }

                var localEngineer = selectedEngineer ??
                    manualEngineer ??
                    await BuildEngineerFromSecureStorageAsync(activeEngineerId, storedHash);

                if (localEngineer is not null)
                {
                    if (IsProjectInchargeRole(localEngineer.ResponsibilityCode) && !await HasBackendTokenAsync())
                    {
                        HasError = true;
                        StatusMessage = "Project Incharge login needs online backend verification. Please check internet access and try again.";
                        PinInput = string.Empty;
                        return;
                    }

                    await CompleteLoginAsync(localEngineer);
                    return;
                }

                HasError = true;
                StatusMessage = "Access Denied: No valid SIE/SER/Project Incharge role assigned to this user.";
                PinInput = string.Empty;
                return;
            }

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

            await ShowIncorrectPinAsync(activeEngineerId);
        });
    }

    [RelayCommand]
    private void AddDigit(string? digit)
    {
        if (IsLoginLockedOut || string.IsNullOrWhiteSpace(digit) || PinInput.Length >= PinLength)
        {
            return;
        }

        PinInput += digit;
        ResetInactivityTimer();
    }

    [RelayCommand]
    private void Backspace()
    {
        if (IsLoginLockedOut || PinInput.Length == 0)
        {
            return;
        }

        PinInput = PinInput[..^1];
        ResetInactivityTimer();
    }

    [RelayCommand]
    private void ClearPin()
    {
        if (IsLoginLockedOut || PinInput.Length == 0)
        {
            return;
        }

        _isAutoLoginQueued = false;
        PinInput = string.Empty;
        ResetInactivityTimer();
    }

    [RelayCommand]
    private void TogglePinVisibility()
    {
        IsPinVisible = !IsPinVisible;
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
            "Forgot Password",
            $"Password changes must be authorized by a System Administrator.\n\nPlease reach out to your System Administrator to reset the password for {accountName}.",
            "OK");
    }

    public async Task LogoutAsync()
    {
        _lockoutCancellationTokenSource?.Cancel();
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
        OnPropertyChanged(nameof(HasPinInput));
        OnPropertyChanged(nameof(ShowPinPlaceholder));
        NotifyPinCharactersChanged();

        if (HasError && !IsLoginLockedOut)
        {
            HasError = false;
            StatusMessage = string.Empty;
        }

        if (cleaned.Length == PinLength && !IsLoginLockedOut && !_isAutoLoginQueued)
        {
            _isAutoLoginQueued = true;
            MainThread.BeginInvokeOnMainThread(async () => await LoginAsync());
        }
    }

    partial void OnIsPinVisibleChanged(bool value)
    {
        OnPropertyChanged(nameof(IsPinHidden));
        NotifyPinCharactersChanged();
    }

    partial void OnIsLoginLockedOutChanged(bool value)
    {
        OnPropertyChanged(nameof(IsPinEntryEnabled));
    }

    partial void OnLockoutSecondsRemainingChanged(int value)
    {
        if (IsLoginLockedOut)
        {
            StatusMessage = $"Too many wrong attempts. Try again in {LockoutSecondsRemaining} sec.";
        }
    }

    private async Task ShowIncorrectPinAsync(string engineerId)
    {
        _failedLoginAttempts++;
        _isAutoLoginQueued = false;
        PinInput = string.Empty;

        if (_failedLoginAttempts >= MaxFailedLoginAttempts)
        {
            await StartLoginLockoutAsync();
            return;
        }

        var attemptsLeft = MaxFailedLoginAttempts - _failedLoginAttempts;
        HasError = true;
        StatusMessage = $"Incorrect PIN for Employee ID: {engineerId}. {attemptsLeft} attempt(s) left.";
        await Task.Delay(1000);
    }

    private async Task StartLoginLockoutAsync()
    {
        _lockoutCancellationTokenSource?.Cancel();
        _lockoutCancellationTokenSource = new CancellationTokenSource();
        var token = _lockoutCancellationTokenSource.Token;

        IsLoginLockedOut = true;
        HasError = true;
        LockoutSecondsRemaining = LoginLockoutSeconds;
        PinInput = string.Empty;
        _isAutoLoginQueued = false;

        try
        {
            while (LockoutSecondsRemaining > 0)
            {
                await Task.Delay(1000, token);
                LockoutSecondsRemaining--;
            }
        }
        catch (TaskCanceledException)
        {
            return;
        }
        finally
        {
            if (!token.IsCancellationRequested)
            {
                _failedLoginAttempts = 0;
                IsLoginLockedOut = false;
                LockoutSecondsRemaining = 0;
                HasError = false;
                StatusMessage = string.Empty;
            }
        }
    }

    private string GetPinCharacter(int index)
    {
        if (PinInput.Length <= index)
        {
            return string.Empty;
        }

        return IsPinVisible ? PinInput[index].ToString() : "\u25CF";
    }

    private void NotifyPinCharactersChanged()
    {
        OnPropertyChanged(nameof(PinChar1));
        OnPropertyChanged(nameof(PinChar2));
        OnPropertyChanged(nameof(PinChar3));
        OnPropertyChanged(nameof(PinChar4));
        OnPropertyChanged(nameof(PinChar5));
        OnPropertyChanged(nameof(PinChar6));
    }

    private async Task<LocalEngineer?> AuthenticateManualUserAsync(string engineerId, string password)
    {
        HttpResponseMessage? lastFailedResponse = null;
        var hadConnectionFailure = false;

        foreach (var baseUrl in ApiEndpoints.CandidateBaseUrls)
        {
            try
            {
                var response = await _httpClient.PostAsJsonAsync(new Uri(new Uri(baseUrl), "/api/auth/web-login"), new
                {
                    employee_id = engineerId,
                    login_name = engineerId,
                    password
                });

                if (!response.IsSuccessStatusCode)
                {
                    lastFailedResponse = response;
                    continue;
                }

                var loginResponse = await response.Content.ReadFromJsonAsync<LoginApiResponse>();
                if (loginResponse?.Token is null || loginResponse.User is null)
                {
                    lastFailedResponse = response;
                    continue;
                }

                ApiEndpoints.SetActiveBaseUrl(baseUrl);
                var loginName = NormalizeEngineerId(
                    loginResponse.User.EmployeeId ??
                    loginResponse.User.LoginName ??
                    engineerId);
                var responseName = loginResponse.User.EmployeeName ?? loginResponse.User.Name;
                var employeeName = string.IsNullOrWhiteSpace(responseName)
                    ? loginName
                    : responseName.Trim();
                var role = ResolveAppRole(loginResponse.User);

                await SecureStorage.Default.SetAsync("jwt_token", loginResponse.Token);
                SaveProjectInchargeProjects(loginResponse.User.AssignedProjects);

                return new LocalEngineer
                {
                    EngineerId = loginName,
                    Name = employeeName,
                    Company = await SecureStorage.Default.GetAsync("company") ?? Company,
                    PinHash = LNApiService.ComputeSHA256Hash(password),
                    LNEnvironment = await SecureStorage.Default.GetAsync("ln_environment") ?? string.Empty,
                    ResponsibilityCode = role,
                    LastSyncAt = DateTime.UtcNow
                };
            }
            catch
            {
                hadConnectionFailure = true;
            }
        }

        if (lastFailedResponse is not null)
        {
            await HandleFailedBackendLoginAsync(lastFailedResponse, engineerId);
            return null;
        }

        if (hadConnectionFailure)
        {
            HasError = true;
            StatusMessage = "Could not reach the IndentMate backend. Please check internet access and try again.";
            return null;
        }

        return null;
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
            (string.Equals(loginError?.ErrorCode, "ACCOUNT_INACTIVE", StringComparison.OrdinalIgnoreCase) ||
             string.Equals(loginError?.ErrorCode, "ACCOUNT_DEACTIVATED", StringComparison.OrdinalIgnoreCase)))
        {
            await PurgeDeactivatedEngineerAsync(engineerId);
            HasError = true;
            StatusMessage = "User is deactivated, or no longer in use.";
            PinInput = string.Empty;
            return;
        }

        if (response.StatusCode == System.Net.HttpStatusCode.Forbidden &&
            string.Equals(loginError?.ErrorCode, "UNAUTHORIZED_FIELD_ROLE", StringComparison.OrdinalIgnoreCase))
        {
            HasError = true;
            StatusMessage = "Access Denied: This application is restricted to field personnel and Project Incharge users only.";
            PinInput = string.Empty;
            return;
        }

        if (response.StatusCode == System.Net.HttpStatusCode.Forbidden &&
            !string.IsNullOrWhiteSpace(loginError?.Message))
        {
            HasError = true;
            StatusMessage = loginError.Message;
            PinInput = string.Empty;
            return;
        }

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound &&
            string.Equals(loginError?.ErrorCode, "LOGIN_ID_NOT_FOUND", StringComparison.OrdinalIgnoreCase))
        {
            await PurgeDeactivatedEngineerAsync(engineerId);
            HasError = true;
            StatusMessage = "No login ID found.";
            PinInput = string.Empty;
            return;
        }

        if (response.StatusCode != System.Net.HttpStatusCode.Unauthorized)
        {
            HasError = true;
            StatusMessage = loginError?.Message ?? $"Backend authentication failed with status {(int)response.StatusCode}. Please try again.";
            PinInput = string.Empty;
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

        var storedRole = await SecureStorage.Default.GetAsync("user_role");
        var responsibilityCode = NormalizeRole(storedRole);
        if (responsibilityCode is not ("SER" or "SIE" or "PRI"))
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
            ResponsibilityCode = responsibilityCode,
            LastSyncAt = DateTime.UtcNow
        };
    }

    private async Task CompleteLoginAsync(LocalEngineer? authenticatedEngineer)
    {
        var dashboardRoute = ResolveDashboardRoute(authenticatedEngineer?.ResponsibilityCode);
        if (dashboardRoute is null)
        {
            SecureStorage.Default.Remove("session_active");
            HasError = true;
            StatusMessage = "Access Denied: No valid SIE/SER/Project Incharge role assigned to this user.";
            PinInput = string.Empty;
            return;
        }

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
            await SecureStorage.Default.SetAsync("user_role", authenticatedEngineer.ResponsibilityCode);
            SelectedEngineer = authenticatedEngineer;
            ManualEngineerId = string.Empty;
            await LoadRecentEngineersAsync();
        }

        HasError = false;
        StatusMessage = string.Empty;
        _failedLoginAttempts = 0;
        IsLoginLockedOut = false;
        LockoutSecondsRemaining = 0;
        await SecureStorage.Default.SetAsync("session_active", "true");
        await SecureStorage.Default.SetAsync("session_expires_at_utc", DateTime.UtcNow.AddMinutes(10).ToString("O"));

        await Shell.Current.GoToAsync("//login-success");
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

    private static string NormalizeRole(string? role)
    {
        var normalizedRole = (role ?? string.Empty).Trim().ToUpperInvariant();

        return normalizedRole switch
        {
            "SRE" => "SER",
            _ when normalizedRole.Contains("(SER)") || normalizedRole.Contains("(SRE)") => "SER",
            _ when normalizedRole.Contains("SERVICE ENGINEER") || normalizedRole.Contains("SITE RECEIVING") => "SER",
            _ when normalizedRole.Contains("(SIE)") || normalizedRole.Contains("SITE ENGINEER") => "SIE",
            "PRI" => "PRI",
            _ when normalizedRole.Contains("(PRI)") || normalizedRole.Contains("PROJECT INCHARGE") => "PRI",
            _ => normalizedRole
        };
    }

    private static string? ResolveDashboardRoute(string? role)
    {
        return NormalizeRole(role) switch
        {
            "SIE" => "//sie-dashboard",
            "SER" => "//ser-dashboard",
            "PRI" => "//project-incharge-dashboard",
            _ => null
        };
    }

    private static async Task<bool> HasBackendTokenAsync()
    {
        return !string.IsNullOrWhiteSpace(await SecureStorage.Default.GetAsync("jwt_token"));
    }

    private static bool IsProjectInchargeRole(string? role)
    {
        return NormalizeRole(role) == "PRI";
    }

    private static bool IsBackendConnectionError(string? message)
    {
        return string.Equals(message, BackendConnectionErrorMessage, StringComparison.Ordinal) ||
            (message?.Contains("Could not reach the IndentMate backend", StringComparison.OrdinalIgnoreCase) ?? false);
    }

    private static string ResolveAppRole(LoginApiUser user)
    {
        var hasProjectInchargeAssignment = user.AssignedProjects.Any(project => NormalizeRole(project.RoleName) == "PRI");
        if (hasProjectInchargeAssignment)
        {
            return "PRI";
        }

        return NormalizeRole(user.Role ?? user.PrimaryRole);
    }

    private static void SaveProjectInchargeProjects(IEnumerable<LoginApiAssignedProject>? assignedProjects)
    {
        var projects = (assignedProjects ?? Enumerable.Empty<LoginApiAssignedProject>())
            .Where(project => NormalizeRole(project.RoleName) == "PRI")
            .Select(project =>
            {
                var projectCode = (project.ProjectId ?? string.Empty).Trim();
                var projectName = (project.ProjectName ?? string.Empty).Trim();
                return new ProjectReviewProjectOption
                {
                    ProjectCode = projectCode,
                    Label = string.IsNullOrWhiteSpace(projectName) ? projectCode : $"{projectCode} - {projectName}"
                };
            })
            .Where(project => !string.IsNullOrWhiteSpace(project.ProjectCode))
            .GroupBy(project => project.ProjectCode, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(project => project.ProjectCode)
            .ToList();

        Preferences.Default.Set("project_incharge_projects", JsonSerializer.Serialize(projects));
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

        [JsonPropertyName("employeeName")]
        public string? EmployeeNameCamel { set => EmployeeName = value; }

        [JsonPropertyName("employeeId")]
        public string? EmployeeId { get; set; }

        [JsonPropertyName("role")]
        public string? Role { get; set; }

        [JsonPropertyName("primary_role")]
        public string? PrimaryRole { get; set; }

        [JsonPropertyName("assigned_projects")]
        public List<LoginApiAssignedProject> AssignedProjects { get; set; } = new();

        [JsonPropertyName("assignedProjects")]
        public List<LoginApiAssignedProject> AssignedProjectsCamel { set => AssignedProjects = value ?? new(); }
    }

    private sealed class LoginApiAssignedProject
    {
        [JsonPropertyName("project_id")]
        public string? ProjectId { get; set; }

        [JsonPropertyName("project_name")]
        public string? ProjectName { get; set; }

        [JsonPropertyName("role_name")]
        public string? RoleName { get; set; }
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

}
