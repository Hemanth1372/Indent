using System.Collections;
using System.Reflection;
using System.Windows.Input;
using IndentMate.Mobile.Resources;
using Microsoft.Maui.Controls.Shapes;

namespace IndentMate.Mobile.Controls;

public partial class DropdownField : ContentView
{
    private const double DefaultDropdownWidth = 436;
    private const double ItemHeight = 52;
    private const int MaxVisibleItems = 10;
    private const double SearchEntryHeight = 44;
    private const int SearchThreshold = 25;

    private static readonly List<WeakReference<DropdownField>> OpenDropdowns = new();
    private static DateTime ignoreOutsideCloseUntilUtc;
    private Border? popupBorder;
    private List<object> _popupAllItems = new();
    private VerticalStackLayout? _popupItemList;
    private string _currentSearchText = string.Empty;
    private CancellationTokenSource? _searchDebounceCts;
    private bool _suppressSearchTextChanged;

    public static readonly BindableProperty ItemsSourceProperty = BindableProperty.Create(
        nameof(ItemsSource),
        typeof(IEnumerable),
        typeof(DropdownField),
        default(IEnumerable),
        propertyChanged: OnItemsSourceChanged);

    public static readonly BindableProperty SelectedItemProperty = BindableProperty.Create(
        nameof(SelectedItem),
        typeof(object),
        typeof(DropdownField),
        null,
        BindingMode.TwoWay,
        propertyChanged: OnSelectedItemChanged);

    public static readonly BindableProperty DisplayMemberPathProperty = BindableProperty.Create(
        nameof(DisplayMemberPath),
        typeof(string),
        typeof(DropdownField),
        string.Empty,
        propertyChanged: OnDisplayMemberPathChanged);

    public static readonly BindableProperty PlaceholderProperty = BindableProperty.Create(
        nameof(Placeholder),
        typeof(string),
        typeof(DropdownField),
        "Select...",
        propertyChanged: OnPlaceholderChanged);

    public static readonly BindableProperty DropdownHeightProperty = BindableProperty.Create(
        nameof(DropdownHeight),
        typeof(double),
        typeof(DropdownField),
        240d,
        propertyChanged: OnDropdownHeightChanged);

    public static readonly BindableProperty SearchCommandProperty = BindableProperty.Create(
        nameof(SearchCommand),
        typeof(ICommand),
        typeof(DropdownField),
        default(ICommand));

    public static readonly BindableProperty LoadMoreCommandProperty = BindableProperty.Create(
        nameof(LoadMoreCommand),
        typeof(ICommand),
        typeof(DropdownField),
        default(ICommand));

    public static readonly BindableProperty IsLoadingProperty = BindableProperty.Create(
        nameof(IsLoading),
        typeof(bool),
        typeof(DropdownField),
        false,
        propertyChanged: OnAsyncStateChanged);

    public static readonly BindableProperty HasMoreProperty = BindableProperty.Create(
        nameof(HasMore),
        typeof(bool),
        typeof(DropdownField),
        false,
        propertyChanged: OnAsyncStateChanged);

    public static readonly BindableProperty MinimumSearchLengthProperty = BindableProperty.Create(
        nameof(MinimumSearchLength),
        typeof(int),
        typeof(DropdownField),
        0);

    public DropdownField()
    {
        InitializeComponent();
        MaximumWidthRequest = DefaultDropdownWidth;
        UpdateSelectedText();
    }

    public IEnumerable? ItemsSource
    {
        get => (IEnumerable?)GetValue(ItemsSourceProperty);
        set => SetValue(ItemsSourceProperty, value);
    }

    public object? SelectedItem
    {
        get => GetValue(SelectedItemProperty);
        set => SetValue(SelectedItemProperty, value);
    }

    public string DisplayMemberPath
    {
        get => (string)GetValue(DisplayMemberPathProperty);
        set => SetValue(DisplayMemberPathProperty, value);
    }

    public string Placeholder
    {
        get => (string)GetValue(PlaceholderProperty);
        set => SetValue(PlaceholderProperty, value);
    }

    public double DropdownHeight
    {
        get => (double)GetValue(DropdownHeightProperty);
        set => SetValue(DropdownHeightProperty, value);
    }

    public ICommand? SearchCommand
    {
        get => (ICommand?)GetValue(SearchCommandProperty);
        set => SetValue(SearchCommandProperty, value);
    }

    public ICommand? LoadMoreCommand
    {
        get => (ICommand?)GetValue(LoadMoreCommandProperty);
        set => SetValue(LoadMoreCommandProperty, value);
    }

    public bool IsLoading
    {
        get => (bool)GetValue(IsLoadingProperty);
        set => SetValue(IsLoadingProperty, value);
    }

    public bool HasMore
    {
        get => (bool)GetValue(HasMoreProperty);
        set => SetValue(HasMoreProperty, value);
    }

    public int MinimumSearchLength
    {
        get => (int)GetValue(MinimumSearchLengthProperty);
        set => SetValue(MinimumSearchLengthProperty, value);
    }

    public static void CloseAll()
    {
        OpenDropdowns.RemoveAll(reference => !reference.TryGetTarget(out _));

        foreach (var reference in OpenDropdowns.ToList())
        {
            if (reference.TryGetTarget(out var dropdown))
            {
                dropdown.SetOpen(false);
            }
        }
    }

    public static void CloseAllFromOutsideTap()
    {
        if (DateTime.UtcNow < ignoreOutsideCloseUntilUtc)
            return;

        CloseAll();
    }

    private static void OnSelectedItemChanged(BindableObject bindable, object oldValue, object newValue)
    {
        var dropdown = (DropdownField)bindable;
        dropdown.UpdateSelectedText();
        dropdown.RefreshOpenPopup();
    }

    private static void OnItemsSourceChanged(BindableObject bindable, object oldValue, object newValue)
    {
        ((DropdownField)bindable).RefreshOpenPopup();
    }

    private static void OnDisplayMemberPathChanged(BindableObject bindable, object oldValue, object newValue)
    {
        var dropdown = (DropdownField)bindable;
        dropdown.UpdateSelectedText();
        dropdown.RefreshOpenPopup();
    }

    private static void OnPlaceholderChanged(BindableObject bindable, object oldValue, object newValue)
    {
        ((DropdownField)bindable).UpdateSelectedText();
    }

    private static void OnDropdownHeightChanged(BindableObject bindable, object oldValue, object newValue)
    {
        if (((DropdownField)bindable).popupBorder is { } popup)
        {
            popup.HeightRequest = (double)newValue;
        }
    }

    private static void OnAsyncStateChanged(BindableObject bindable, object oldValue, object newValue)
    {
        ((DropdownField)bindable).RefreshOpenPopup();
    }

    private void OnTriggerTapped(object? sender, TappedEventArgs e)
    {
        ignoreOutsideCloseUntilUtc = DateTime.UtcNow.AddMilliseconds(150);
        var shouldOpen = popupBorder is null;
        CloseAll();
        SetOpen(shouldOpen);
    }

    private void SetOpen(bool isOpen)
    {
        TriggerBorder.Stroke = isOpen ? Color.FromArgb("#0E2A5C") : Color.FromArgb("#D6DEE9");
        TriggerBorder.StrokeThickness = isOpen ? 1.5 : 1;
        ChevronLabel.TextColor = isOpen ? Color.FromArgb("#0E2A5C") : Color.FromArgb("#667085");
        ChevronLabel.Text = isOpen ? IconGlyphs.ChevronUp : IconGlyphs.ChevronDown;
        ZIndex = isOpen ? 1000 : 0;

        if (!isOpen)
        {
            RemovePopup();
            return;
        }

        ShowPopup();
        SearchInitialSuggestionsIfNeeded();

        OpenDropdowns.RemoveAll(reference => !reference.TryGetTarget(out _));
        if (!OpenDropdowns.Any(reference => reference.TryGetTarget(out var dropdown) && ReferenceEquals(dropdown, this)))
        {
            OpenDropdowns.Add(new WeakReference<DropdownField>(this));
        }
    }

    private void RefreshOpenPopup()
    {
        if (popupBorder is not null)
        {
            _popupAllItems = ItemsSource?.Cast<object>().ToList() ?? new List<object>();
            BuildPopupItemList(_popupAllItems);
        }
    }

    private void UpdateSelectedText()
    {
        var text = GetDisplayText(SelectedItem);
        SelectedTextLabel.Text = string.IsNullOrWhiteSpace(text) ? Placeholder : text;
        SelectedTextLabel.TextColor = string.IsNullOrWhiteSpace(text)
            ? Color.FromArgb("#667085")
            : Color.FromArgb("#172033");
    }

    private string GetDisplayText(object? item)
    {
        if (item is null)
            return string.Empty;

        if (string.IsNullOrWhiteSpace(DisplayMemberPath))
            return item.ToString() ?? string.Empty;

        var property = item.GetType().GetRuntimeProperty(DisplayMemberPath);
        return property?.GetValue(item)?.ToString() ?? string.Empty;
    }

    private void ShowPopup()
    {
        RemovePopup();

        if (ItemsSource is null || FindPageRoot() is not Grid root)
            return;

        _popupAllItems = ItemsSource.Cast<object>().ToList();
        var isServerSearch = SearchCommand is not null || LoadMoreCommand is not null;

        if (_popupAllItems.Count == 0 && !isServerSearch)
            return;

        var position = GetPopupPlacement(root);
        var popupWidth = GetPopupWidth();
        var useSearch = isServerSearch || _popupAllItems.Count >= SearchThreshold;

        _popupItemList = new VerticalStackLayout { BackgroundColor = Colors.White, Spacing = 0 };
        BuildPopupItemList(_popupAllItems);

        var visibleItemCount = Math.Min(Math.Max(_popupAllItems.Count, 1), MaxVisibleItems);
        var listHeight = Math.Max(ItemHeight, visibleItemCount * ItemHeight);

        var listScroll = new ScrollView
        {
            BackgroundColor = Colors.White,
            Content = _popupItemList,
            HeightRequest = listHeight,
            VerticalScrollBarVisibility = _popupAllItems.Count > MaxVisibleItems
                ? ScrollBarVisibility.Default
                : ScrollBarVisibility.Never
        };

        View content;
        double popupHeight;

        if (useSearch)
        {
            var searchEntry = new Entry
            {
                Placeholder = "Search...",
                BackgroundColor = Colors.White,
                PlaceholderColor = Color.FromArgb("#94A3B8"),
                TextColor = Color.FromArgb("#172033"),
                FontSize = 14,
                HeightRequest = SearchEntryHeight,
                Margin = new Thickness(12, 6, 12, 4),
                ClearButtonVisibility = ClearButtonVisibility.WhileEditing,
            };

            if (isServerSearch)
            {
                _suppressSearchTextChanged = true;
                searchEntry.Text = _currentSearchText;
                _suppressSearchTextChanged = false;
            }

            searchEntry.TextChanged += (_, e) =>
            {
                var query = (e.NewTextValue ?? string.Empty).Trim();

                if (isServerSearch)
                {
                    _currentSearchText = query;
                    DebounceServerSearch(query);
                    return;
                }

                var filtered = string.IsNullOrWhiteSpace(query)
                    ? _popupAllItems
                    : _popupAllItems
                        .Where(item => GetDisplayText(item)
                            .Contains(query, StringComparison.OrdinalIgnoreCase))
                        .ToList();
                BuildPopupItemList(filtered);
            };

            var children = new List<View>
            {
                searchEntry,
                new BoxView { Color = Color.FromArgb("#EFF2F7"), HeightRequest = 1 },
                listScroll
            };

            if (isServerSearch && HasMore)
            {
                children.Add(new BoxView { Color = Color.FromArgb("#EFF2F7"), HeightRequest = 1 });
                children.Add(CreateLoadMoreButton());
            }

            var searchContent = new VerticalStackLayout
            {
                BackgroundColor = Colors.White,
                Spacing = 0
            };
            foreach (var child in children)
            {
                searchContent.Children.Add(child);
            }
            content = searchContent;

            popupHeight = SearchEntryHeight + 1 + listHeight;
            if (isServerSearch && HasMore)
                popupHeight += 45;
        }
        else
        {
            content = listScroll;
            popupHeight = listHeight;
        }

        popupBorder = new Border
        {
            BackgroundColor = Colors.White,
            HeightRequest = popupHeight,
            Stroke = Color.FromArgb("#0E2A5C"),
            StrokeShape = new RoundRectangle { CornerRadius = new CornerRadius(10) },
            StrokeThickness = 1.5,
            Content = content,
            Margin = new Thickness(position.X, position.Y, 0, 0),
            WidthRequest = popupWidth,
            HorizontalOptions = LayoutOptions.Start,
            VerticalOptions = LayoutOptions.Start,
            ZIndex = 10000
        };

        popupBorder.Shadow = new Shadow
        {
            Brush = new SolidColorBrush(Color.FromRgba("#0E2A5C30")),
            Offset = new Point(0, 4),
            Radius = 12,
            Opacity = 0.30f
        };

        Grid.SetRow(popupBorder, position.GridRow);
        Grid.SetRowSpan(popupBorder, position.GridRowSpan);
        root.Children.Add(popupBorder);

        if (useSearch)
        {
            var entry = (content as VerticalStackLayout)?.Children.OfType<Entry>().FirstOrDefault();
            entry?.Focus();
        }
    }

    private void BuildPopupItemList(List<object> items)
    {
        if (_popupItemList is null) return;
        _popupItemList.Children.Clear();
        var orderedItems = PrioritizeSelectedItem(items);

        if (orderedItems.Count == 0)
        {
            _popupItemList.Children.Add(CreateStatusRow(GetEmptyStateText()));
        }

        foreach (var item in orderedItems)
            _popupItemList.Children.Add(CreateOptionRow(item));

        if (IsLoading && orderedItems.Count != 0)
        {
            _popupItemList.Children.Add(CreateStatusRow("Loading..."));
        }
    }

    private List<object> PrioritizeSelectedItem(List<object> items)
    {
        if (SelectedItem is null || items.Count <= 1)
            return items;

        var selectedIndex = items.FindIndex(item => IsSameOption(item, SelectedItem));
        if (selectedIndex <= 0)
            return items;

        var selectedItem = items[selectedIndex];
        var orderedItems = new List<object> { selectedItem };
        orderedItems.AddRange(items.Where((_, index) => index != selectedIndex));
        return orderedItems;
    }

    private void RemovePopup()
    {
        if (popupBorder is null)
            return;

        if (popupBorder.Parent is Layout parent)
        {
            parent.Children.Remove(popupBorder);
        }

        popupBorder = null;
        _popupItemList = null;
        _popupAllItems = new();
    }

    private Grid? FindPageRoot()
    {
        Element? current = this;
        while (current is not null)
        {
            if (current is ContentPage { Content: Grid grid })
                return grid;

            current = current.Parent;
        }

        return null;
    }

    private Point GetPositionRelativeTo(VisualElement root)
    {
        var x = X;
        var y = Y;
        Element? current = Parent;

        while (current is VisualElement element && !ReferenceEquals(element, root))
        {
            x += element.X;
            y += element.Y;
            if (element is ScrollView sv)
                y -= sv.ScrollY;
            current = element.Parent;
        }

        return new Point(x, y);
    }

    private PopupPlacement GetPopupPlacement(Grid root)
    {
        var scrollView = FindAncestorScrollView();
        if (scrollView is not null)
        {
            var positionInScrollView = GetPositionRelativeTo(scrollView);
            var row = Grid.GetRow(scrollView);
            var rowSpan = Math.Max(1, Grid.GetRowSpan(scrollView));

            return new PopupPlacement(
                positionInScrollView.X,
                positionInScrollView.Y - scrollView.ScrollY + TriggerBorder.Height - 1,
                row,
                rowSpan);
        }

        var position = GetPositionRelativeTo(root);
        return new PopupPlacement(
            position.X,
            position.Y + TriggerBorder.Height - 1,
            0,
            Math.Max(1, root.RowDefinitions.Count));
    }

    private ScrollView? FindAncestorScrollView()
    {
        Element? current = Parent;
        while (current is not null)
        {
            if (current is ScrollView scrollView)
                return scrollView;

            current = current.Parent;
        }

        return null;
    }

    private sealed record PopupPlacement(double X, double Y, int GridRow, int GridRowSpan);

    private View CreateOptionRow(object item)
    {
        var isSelected = IsSameOption(item, SelectedItem);
        var primaryText = GetPrimaryText(item);
        var secondaryText = GetSecondaryText(item);

        var rowText = new VerticalStackLayout
        {
            Spacing = 2,
            VerticalOptions = LayoutOptions.Center,
            Children =
            {
                new Label
                {
                    FontSize = 14,
                    FontAttributes = FontAttributes.Bold,
                    LineBreakMode = LineBreakMode.TailTruncation,
                    Text = primaryText,
                    TextColor = isSelected ? Colors.White : Color.FromArgb("#172033")
                }
            }
        };

        if (!string.IsNullOrWhiteSpace(secondaryText))
        {
            rowText.Children.Add(new Label
            {
                FontSize = 12,
                LineBreakMode = LineBreakMode.TailTruncation,
                Text = secondaryText,
                TextColor = isSelected ? Color.FromArgb("#D8E8FF") : Color.FromArgb("#667085")
            });
        }

        var row = new Grid
        {
            ColumnDefinitions =
            {
                new ColumnDefinition { Width = GridLength.Star },
                new ColumnDefinition { Width = GridLength.Auto }
            },
            Padding = new Thickness(16, 6),
            HeightRequest = ItemHeight,
            BackgroundColor = isSelected ? Color.FromArgb("#0E2A5C") : Colors.White,
            Children = { rowText }
        };

        if (isSelected)
        {
            var selectedMark = new Label
            {
                Text = "OK",
                FontSize = 12,
                FontAttributes = FontAttributes.Bold,
                TextColor = Colors.White,
                HorizontalOptions = LayoutOptions.Center,
                VerticalOptions = LayoutOptions.Center,
                Margin = new Thickness(12, 0, 0, 0)
            };
            Grid.SetColumn(selectedMark, 1);
            row.Children.Add(selectedMark);
        }

        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) => SelectOption(item);
        row.GestureRecognizers.Add(tap);

        return row;
    }

    private void SelectOption(object item)
    {
        _searchDebounceCts?.Cancel();
        SelectedItem = item;
        _currentSearchText = string.Empty;
        SetOpen(false);

        if (SearchCommand?.CanExecute(string.Empty) == true)
        {
            SearchCommand.Execute(string.Empty);
        }
    }

    private string GetPrimaryText(object item)
    {
        if (TryGetTextProperty(item, "ItemCode", out var itemCode))
            return itemCode;

        if (TryGetTextProperty(item, "ActivityId", out var activityId))
            return activityId;

        return GetDisplayText(item);
    }

    private string GetSecondaryText(object item)
    {
        if (TryGetTextProperty(item, "Description", out var description))
            return description;

        var displayText = GetDisplayText(item);
        var primaryText = GetPrimaryText(item);
        return string.Equals(displayText, primaryText, StringComparison.Ordinal)
            ? string.Empty
            : displayText;
    }

    private static bool TryGetTextProperty(object item, string propertyName, out string value)
    {
        value = item.GetType().GetRuntimeProperty(propertyName)?.GetValue(item)?.ToString()?.Trim() ?? string.Empty;
        return !string.IsNullOrWhiteSpace(value);
    }

    private static bool IsSameOption(object? left, object? right)
    {
        if (left is null || right is null)
            return false;

        if (ReferenceEquals(left, right) || Equals(left, right))
            return true;

        return SameTextProperty(left, right, "ItemCode") ||
               SameTextProperty(left, right, "ActivityId") ||
               SameTextProperty(left, right, "LocationCode") ||
               SameTextProperty(left, right, "Id");
    }

    private static bool SameTextProperty(object left, object right, string propertyName)
    {
        return TryGetTextProperty(left, propertyName, out var leftValue) &&
               TryGetTextProperty(right, propertyName, out var rightValue) &&
               string.Equals(leftValue, rightValue, StringComparison.OrdinalIgnoreCase);
    }

    private View CreateLoadMoreButton()
    {
        var button = new Button
        {
            Text = IsLoading ? "Loading..." : "Load more",
            FontSize = 14,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#0E2A5C"),
            BackgroundColor = Colors.White,
            HeightRequest = 44,
            IsEnabled = !IsLoading,
            Padding = new Thickness(12, 0)
        };

        button.Clicked += (_, _) =>
        {
            if (LoadMoreCommand?.CanExecute(_currentSearchText) == true)
            {
                LoadMoreCommand.Execute(_currentSearchText);
            }
        };

        return button;
    }

    private View CreateStatusRow(string text)
    {
        return new Grid
        {
            Padding = new Thickness(16, 0),
            HeightRequest = ItemHeight,
            BackgroundColor = Colors.White,
            Children =
            {
                new Label
                {
                    FontSize = 14,
                    LineBreakMode = LineBreakMode.TailTruncation,
                    Text = text,
                    TextColor = Color.FromArgb("#667085"),
                    VerticalOptions = LayoutOptions.Center
                }
            }
        };
    }

    private string GetEmptyStateText()
    {
        if (IsLoading)
            return "Loading...";

        if (SearchCommand is not null && string.IsNullOrWhiteSpace(_currentSearchText))
            return "No suggestions found";

        return "No results";
    }

    private void DebounceServerSearch(string query)
    {
        if (_suppressSearchTextChanged)
            return;

        _searchDebounceCts?.Cancel();
        _searchDebounceCts = new CancellationTokenSource();
        var token = _searchDebounceCts.Token;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(300, token);
                if (token.IsCancellationRequested)
                    return;

                await MainThread.InvokeOnMainThreadAsync(() =>
                {
                    if (SearchCommand?.CanExecute(query) == true)
                    {
                        SearchCommand.Execute(query);
                    }
                });
            }
            catch (TaskCanceledException)
            {
            }
        }, token);
    }

    private void SearchInitialSuggestionsIfNeeded()
    {
        if (SearchCommand is null || IsLoading)
            return;

        if (!string.IsNullOrWhiteSpace(_currentSearchText))
            return;

        var hasItems = ItemsSource?.Cast<object>().Any() == true;
        if (hasItems)
            return;

        if (SearchCommand.CanExecute(string.Empty))
        {
            SearchCommand.Execute(string.Empty);
        }
    }

    private double GetPopupWidth()
    {
        if (TriggerBorder.Width > 0)
            return TriggerBorder.Width;

        if (Width > 0)
            return Math.Min(Width, DefaultDropdownWidth);

        return DefaultDropdownWidth;
    }
}
