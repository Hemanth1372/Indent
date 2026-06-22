using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using IndentMate.Mobile.Data;
using IndentMate.Mobile.Services;
using System.Collections.ObjectModel;
using System.Text.Json;

namespace IndentMate.Mobile.ViewModels;

public partial class AddItemSERViewModel : BaseViewModel, IQueryAttributable
{
    private const long MaxAttachmentBytes = 5 * 1024 * 1024;
    private const int SearchPageSize = 80;
    private readonly DatabaseService _databaseService;
    private readonly ApiService _apiService;
    private LocalIndent? _indent;
    private LocalProject? _project;
    private int _materialOffset;
    private int _materialSearchVersion;
    private string _materialSearchText = string.Empty;
    private LocalIndentItem? _editingItem;

    public ObservableCollection<LocalItem> Materials { get; } = new();
    public ObservableCollection<AttachmentSelection> Attachments { get; } = new();
    public List<string> Categories { get; } = new() { "Spare", "Diesel", "Other" };

    [ObservableProperty] private string _indentId = string.Empty;
    [ObservableProperty] private string _itemLineId = string.Empty;
    [ObservableProperty] private LocalItem? _selectedMaterial;
    [ObservableProperty] private string _selectedCategory = "Spare";
    [ObservableProperty] private string _uoM = string.Empty;
    [ObservableProperty] private string _requestedQty = string.Empty;
    [ObservableProperty] private string _remarks = string.Empty;
    [ObservableProperty] private string _attachmentName = string.Empty;
    [ObservableProperty] private string _attachmentPath = string.Empty;
    [ObservableProperty] private string _validationMessage = string.Empty;
    [ObservableProperty] private bool _isMaterialSearchLoading;
    [ObservableProperty] private bool _hasMoreMaterials;

    public bool HasAttachment => Attachments.Count > 0;
    public bool HasValidationError => !string.IsNullOrWhiteSpace(ValidationMessage);

    public AddItemSERViewModel()
        : this(new DatabaseService(Path.Combine(FileSystem.AppDataDirectory, "indentmate.db")), new ApiService())
    {
    }

    public AddItemSERViewModel(DatabaseService databaseService)
        : this(databaseService, new ApiService())
    {
    }

    public AddItemSERViewModel(DatabaseService databaseService, ApiService apiService)
    {
        _databaseService = databaseService;
        _apiService = apiService;
        Attachments.CollectionChanged += (_, _) =>
        {
            SyncAttachmentFields();
            OnPropertyChanged(nameof(HasAttachment));
        };
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (query.TryGetValue("indentId", out var value))
        {
            IndentId = Uri.UnescapeDataString(value?.ToString() ?? string.Empty);
        }
        if (query.TryGetValue("itemLineId", out var itemValue))
        {
            ItemLineId = Uri.UnescapeDataString(itemValue?.ToString() ?? string.Empty);
        }

        _ = LoadAsync();
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
    private async Task AttachCameraAsync()
    {
        ValidationMessage = string.Empty;
        var photo = await MediaPicker.Default.CapturePhotoAsync();
        if (photo is not null)
        {
            if (!string.IsNullOrWhiteSpace(photo.FullPath))
            {
                var photoInfo = new FileInfo(photo.FullPath);
                if (photoInfo.Exists && photoInfo.Length > MaxAttachmentBytes)
                {
                    ValidationMessage = "Attachment size must be 5 MB or less.";
                    return;
                }
            }

            AppendAttachment(photo.FileName, photo.FullPath ?? string.Empty);
        }
    }

    [RelayCommand]
    private async Task AttachFileAsync()
    {
        ValidationMessage = string.Empty;
        var file = await FilePicker.Default.PickAsync();
        if (file is null) return;

        await using var stream = await file.OpenReadAsync();
        if (stream.Length > MaxAttachmentBytes)
        {
            ValidationMessage = "Attachment size must be 5 MB or less.";
            return;
        }

        AppendAttachment(file.FileName, file.FullPath ?? string.Empty);
    }

    [RelayCommand]
    private async Task OpenAttachmentAsync(AttachmentSelection? attachment)
    {
        attachment ??= Attachments.FirstOrDefault();
        if (attachment is null || string.IsNullOrWhiteSpace(attachment.Path))
            return;

        await Launcher.Default.OpenAsync(new OpenFileRequest
        {
            File = new ReadOnlyFile(attachment.Path)
        });
    }

    [RelayCommand]
    private void RemoveAttachment(AttachmentSelection? attachment)
    {
        if (attachment is null)
            return;

        Attachments.Remove(attachment);
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

        if (SelectedMaterial.OnHandQty <= 0)
        {
            ValidationMessage = "Selected material does not have available on hand quantity.";
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
            if (await _databaseService.HasDuplicateSERItemAsync(_indent.IndentId, SelectedMaterial.ItemCode, ItemLineId))
            {
                ValidationMessage = "This material has already been added to this indent.";
                return;
            }

            await _databaseService.SaveAsync(new LocalIndentItem
            {
                ItemLineId = _editingItem?.ItemLineId ?? Guid.NewGuid().ToString(),
                IndentId = _indent.IndentId,
                MaterialCode = SelectedMaterial.ItemCode,
                MaterialDesc = SelectedMaterial.Description,
                WorkType = SelectedCategory,
                UoM = UoM,
                RequestedQty = qty,
                Remarks = Remarks,
                AttachmentUrl = AttachmentPath
            });

            await Shell.Current.GoToAsync($"//indent-details?indentId={Uri.EscapeDataString(_indent.IndentId)}");
        });
    }

    [RelayCommand]
    private void IncrementQuantity()
    {
        RequestedQty = AdjustQuantity(1);
    }

    [RelayCommand]
    private void DecrementQuantity()
    {
        RequestedQty = AdjustQuantity(-1);
    }

    private string AdjustQuantity(int delta)
    {
        _ = decimal.TryParse(RequestedQty, out var current);
        var next = Math.Max(0, current + delta);
        return next == 0 ? string.Empty : next.ToString("0.##");
    }

    private async Task LoadAsync()
    {
        await RunBusyAsync(async () =>
        {
            _indent = await _databaseService.GetIndentByIdAsync(IndentId);
            if (_indent is null) return;

            _project = await _databaseService.GetProjectAsync(_indent.ProjectId);
            _editingItem = string.IsNullOrWhiteSpace(ItemLineId)
                ? null
                : await _databaseService.GetIndentItemByLineIdAsync(ItemLineId);
            Materials.Clear();
            SelectedMaterial = null;
            HasMoreMaterials = false;
            await SearchMaterialsAsync(string.Empty);

            if (_editingItem is not null)
                ApplyEditingItem();
        });
    }

    [RelayCommand]
    private async Task SearchMaterialsAsync(string? search)
    {
        var query = (search ?? string.Empty).Trim();
        _materialSearchText = query;
        _materialOffset = 0;
        HasMoreMaterials = false;

        if (_indent is null)
            return;

        var version = ++_materialSearchVersion;
        await LoadMaterialPageAsync(query, reset: true, version);
    }

    [RelayCommand]
    private async Task LoadMoreMaterialsAsync(string? search)
    {
        var query = string.IsNullOrWhiteSpace(search) ? _materialSearchText : search.Trim();

        if (!HasMoreMaterials || IsMaterialSearchLoading)
            return;

        var version = ++_materialSearchVersion;
        await LoadMaterialPageAsync(query, reset: false, version);
    }

    private async Task LoadMaterialPageAsync(string query, bool reset, int version)
    {
        if (_indent is null)
            return;

        IsMaterialSearchLoading = true;
        try
        {
            var projectCode = GetPrimarySiteCode();
            var offset = reset ? 0 : _materialOffset;
            var result = await _apiService.SearchItemsForProjectAsync(projectCode, string.Empty, query, SearchPageSize, offset, "project");
            if (version != _materialSearchVersion)
                return;

            if (result.Data.Count != 0)
                await _databaseService.SaveBatchAsync(result.Data);

            if (version != _materialSearchVersion)
                return;

            if (reset)
                Materials.Clear();

            AddMaterials(result.Data);
            _materialOffset = result.NextOffset;
            HasMoreMaterials = result.HasMore;
        }
        catch
        {
            ValidationMessage = "Could not search materials. Please try again.";
        }
        finally
        {
            if (version == _materialSearchVersion)
                IsMaterialSearchLoading = false;
        }
    }

    private void AddMaterials(IEnumerable<LocalItem> materials)
    {
        foreach (var material in materials.Where(m => m.OnHandQty > 0).OrderBy(m => m.ItemCode))
        {
            if (!Materials.Any(existing =>
                    string.Equals(existing.ItemCode, material.ItemCode, StringComparison.OrdinalIgnoreCase)))
            {
                Materials.Add(material);
            }
        }
    }

    private void ApplyEditingItem()
    {
        if (_editingItem is null)
            return;

        SelectedCategory = string.IsNullOrWhiteSpace(_editingItem.WorkType) ? SelectedCategory : _editingItem.WorkType;
        SelectedMaterial = Materials.FirstOrDefault(material =>
            string.Equals(material.ItemCode, _editingItem.MaterialCode, StringComparison.OrdinalIgnoreCase));
        UoM = _editingItem.UoM;
        RequestedQty = _editingItem.RequestedQty.ToString("0.##");
        Remarks = _editingItem.Remarks;
        AttachmentPath = _editingItem.AttachmentUrl;
        LoadAttachmentItems(_editingItem.AttachmentUrl);
    }

    private void AppendAttachment(string name, string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return;

        Attachments.Add(new AttachmentSelection(name, path));
    }

    private void LoadAttachmentItems(string? value)
    {
        Attachments.Clear();
        foreach (var attachment in ParseAttachments(value))
        {
            Attachments.Add(attachment);
        }
    }

    private void SyncAttachmentFields()
    {
        AttachmentPath = Attachments.Count == 0 ? string.Empty : JsonSerializer.Serialize(Attachments.ToList());
        AttachmentName = FormatAttachmentNames(Attachments);
    }

    private static List<AttachmentSelection> ParseAttachments(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return new List<AttachmentSelection>();

        try
        {
            var attachments = JsonSerializer.Deserialize<List<AttachmentSelection>>(value);
            if (attachments is not null)
                return attachments.Where(attachment => !string.IsNullOrWhiteSpace(attachment.Path)).ToList();
        }
        catch
        {
        }

        return new List<AttachmentSelection>
        {
            new(Path.GetFileName(value), value)
        };
    }

    private static string FormatAttachmentNames(IEnumerable<AttachmentSelection> attachments)
    {
        return string.Join(", ", attachments.Select(attachment => attachment.Name).Where(name => !string.IsNullOrWhiteSpace(name)));
    }

    private string GetPrimarySiteCode()
    {
        return new[] { _project?.SiteCode, _project?.ProjectId, _indent?.ProjectId }
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code!.Trim())
            .FirstOrDefault() ?? string.Empty;
    }
}
