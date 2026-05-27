using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace IndentMate.Mobile.ViewModels;

/// <summary>
/// Base ViewModel for all IndentMate ViewModels.
/// Provides common properties: IsBusy, HasError, StatusMessage.
/// </summary>
public partial class BaseViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsNotBusy))]
    private bool _isBusy;

    [ObservableProperty]
    private bool _hasError;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    /// <summary>Inverse of IsBusy — useful for binding UI enabled states.</summary>
    public bool IsNotBusy => !IsBusy;

    /// <summary>
    /// Sets IsBusy = true, clears any previous error, runs the action, then restores IsBusy.
    /// Catches exceptions and surfaces them as StatusMessage + HasError.
    /// </summary>
    protected async Task RunBusyAsync(Func<Task> action)
    {
        if (IsBusy) return;
        try
        {
            IsBusy = true;
            HasError = false;
            StatusMessage = string.Empty;
            await action();
        }
        catch (Exception ex)
        {
            HasError = true;
            StatusMessage = ex.Message;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
