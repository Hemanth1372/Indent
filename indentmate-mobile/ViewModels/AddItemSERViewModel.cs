using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using System.Collections.ObjectModel;

namespace IndentMate.Mobile.ViewModels;

public partial class AddItemSERViewModel : BaseViewModel, IQueryAttributable
{
    private const long MaxAttachmentBytes = 5 * 1024 * 1024;
    private readonly DatabaseService _databaseService;
    private LocalIndent? _indent;
    private LocalProject? _project;

    public ObservableCollection<LocalItem> Materials { get; } = new();

    [ObservableProperty] private string _indentId = string.Empty;
    [ObservableProperty] private LocalItem? _selectedMaterial;
    [ObservableProperty] private string _uoM = string.Empty;
    [ObservableProperty] private string _requestedQty = string.Empty;
    [ObservableProperty] private string _remarks = string.Empty;
    [ObservableProperty] private string _attachmentName = string.Empty;
    [ObservableProperty] private string _attachmentPath = string.Empty;
    [ObservableProperty] private string _validationMessage = string.Empty;

    public bool HasAttachment => !string.IsNullOrWhiteSpace(AttachmentName);
    public bool HasValidationError => !string.IsNullOrWhiteSpace(ValidationMessage);

    public AddItemSERViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")))
    {
    }

    public AddItemSERViewModel(DatabaseService databaseService)
    {
        _databaseService = databaseService;
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (query.TryGetValue("indentId", out var value))
        {
            IndentId = Uri.UnescapeDataString(value?.ToString() ?? string.Empty);
            _ = LoadAsync();
        }
    }

    partial void OnSelectedMaterialChanged(LocalItem? value)
    {
        UoM = value?.PurchaseUnit ?? value?.UoM ?? string.Empty;
    }

    partial void OnAttachmentNameChanged(string value)
    {
        OnPropertyChanged(nameof(HasAttachment));
    }

    partial void OnValidationMessageChanged(string value)
    {
        OnPropertyChanged(nameof(HasValidationError));
    }

    [RelayCommand]
    private async Task AttachFileAsync()
    {
        ValidationMessage = string.Empty;

        var action = await Shell.Current.DisplayActionSheet("Attachment", "Cancel", null, "Camera", "Browse File");
        if (action == "Camera")
        {
            var photo = await MediaPicker.Default.CapturePhotoAsync();
            if (photo is not null)
            {
                AttachmentName = photo.FileName;
                AttachmentPath = photo.FullPath ?? string.Empty;
            }
        }
        else if (action == "Browse File")
        {
            var file = await FilePicker.Default.PickAsync();
            if (file is null) return;

            await using var stream = await file.OpenReadAsync();
            if (stream.Length > MaxAttachmentBytes)
            {
                ValidationMessage = "Attachment size must be 5 MB or less.";
                return;
            }

            AttachmentName = file.FileName;
            AttachmentPath = file.FullPath ?? string.Empty;
        }
    }

    [RelayCommand]
    private async Task SaveItemAsync()
    {
        ValidationMessage = string.Empty;

        if (_indent is null)
        {
            ValidationMessage = "Indent was not found.";
            return;
        }

        if (SelectedMaterial is null)
        {
            ValidationMessage = "Please select a material.";
            return;
        }

        if (!decimal.TryParse(RequestedQty, out var qty) || qty <= 0)
        {
            ValidationMessage = "Requested quantity must be greater than 0.";
            return;
        }

        if (!string.IsNullOrWhiteSpace(Remarks) && !Remarks.All(c => char.IsLetterOrDigit(c) || char.IsWhiteSpace(c)))
        {
            ValidationMessage = "Remarks must be alphanumeric.";
            return;
        }

        await RunBusyAsync(async () =>
        {
            if (await _databaseService.CountItemsForIndentAsync(_indent.IndentId) >= 20)
            {
                await Shell.Current.DisplayAlert("Limit reached", "Maximum 20 items reached", "OK");
                return;
            }

            await _databaseService.SaveAsync(new LocalIndentItem
            {
                ItemLineId = Guid.NewGuid().ToString(),
                IndentId = _indent.IndentId,
                MaterialCode = SelectedMaterial.ItemCode,
                MaterialDesc = SelectedMaterial.Description,
                WorkType = "SER",
                UoM = UoM,
                RequestedQty = qty,
                Remarks = Remarks,
                AttachmentUrl = AttachmentPath
            });

            await Shell.Current.GoToAsync($"//indent-details?indentId={Uri.EscapeDataString(_indent.IndentId)}");
        });
    }

    private async Task LoadAsync()
    {
        await RunBusyAsync(async () =>
        {
            _indent = await _databaseService.GetIndentByIdAsync(IndentId);
            if (_indent is null) return;

            _project = await _databaseService.GetProjectAsync(_indent.ProjectId);
            await LoadMaterialsAsync();
        });
    }

    private async Task LoadMaterialsAsync()
    {
        Materials.Clear();

        if (_indent is null)
            return;

        var siteCode = _project?.SiteCode;
        if (string.IsNullOrWhiteSpace(siteCode))
            siteCode = _indent.ProjectId;

        var materials = await _databaseService.GetItemsForSiteAsync(siteCode);
        foreach (var material in materials.OrderBy(material => material.ItemCode))
        {
            Materials.Add(material);
        }

        SelectedMaterial ??= Materials.FirstOrDefault();
    }
}
