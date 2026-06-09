using System.Collections;
using System.Reflection;
using Microsoft.Maui.Controls.Shapes;

namespace IndentMate.Mobile.Controls;

public partial class DropdownField : ContentView
{
    private const double DefaultDropdownWidth = 436;
    private const double ItemHeight = 40;
    private const int MaxVisibleItems = 5;

    private static readonly List<WeakReference<DropdownField>> OpenDropdowns = new();
    private static DateTime ignoreOutsideCloseUntilUtc;
    private Border? popupBorder;

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

    private void OnTriggerTapped(object? sender, TappedEventArgs e)
    {
        ignoreOutsideCloseUntilUtc = DateTime.UtcNow.AddMilliseconds(150);
        var shouldOpen = popupBorder is null;
        CloseAll();
        SetOpen(shouldOpen);
    }

    private void OnSelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
    }

    private void SetOpen(bool isOpen)
    {
        TriggerBorder.Stroke = isOpen ? Color.FromArgb("#1565D8") : Color.FromArgb("#D6DEE9");
        ZIndex = isOpen ? 1000 : 0;

        if (!isOpen)
        {
            RemovePopup();
            return;
        }

        ShowPopup();

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
            ShowPopup();
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

    private string GetBindingPath()
    {
        return string.IsNullOrWhiteSpace(DisplayMemberPath) ? "." : DisplayMemberPath;
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

        var items = ItemsSource.Cast<object>().ToList();
        if (items.Count == 0)
            return;

        var position = GetPositionRelativeTo(root);
        var popupWidth = GetPopupWidth();
        var list = new VerticalStackLayout
        {
            BackgroundColor = Colors.White,
            Spacing = 0
        };

        foreach (var item in items)
        {
            list.Children.Add(CreateOptionRow(item));
        }

        var visibleItemCount = Math.Min(items.Count, MaxVisibleItems);
        var popupHeight = Math.Max(ItemHeight, visibleItemCount * ItemHeight);
        var content = new ScrollView
        {
            BackgroundColor = Colors.White,
            Content = list,
            HeightRequest = popupHeight,
            VerticalScrollBarVisibility = items.Count > MaxVisibleItems
                ? ScrollBarVisibility.Default
                : ScrollBarVisibility.Never
        };

        popupBorder = new Border
        {
            BackgroundColor = Colors.White,
            HeightRequest = popupHeight,
            Stroke = Color.FromArgb("#E5E7EB"),
            StrokeShape = new RoundRectangle { CornerRadius = new CornerRadius(8) },
            StrokeThickness = 1,
            Content = content,
            TranslationX = position.X,
            TranslationY = position.Y + Height + 4,
            WidthRequest = popupWidth,
            HorizontalOptions = LayoutOptions.Start,
            VerticalOptions = LayoutOptions.Start,
            ZIndex = 10000
        };

        popupBorder.Shadow = new Shadow
        {
            Brush = new SolidColorBrush(Color.FromRgba("#00000018")),
            Offset = new Point(0, 3),
            Radius = 8,
            Opacity = 0.25f
        };

        Grid.SetRow(popupBorder, 0);
        Grid.SetRowSpan(popupBorder, Math.Max(1, root.RowDefinitions.Count));
        root.Children.Add(popupBorder);
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
            current = element.Parent;
        }

        return new Point(x, y);
    }

    private View CreateOptionRow(object item)
    {
        var isSelected = Equals(item, SelectedItem);

        var label = new Label
        {
            FontSize = 16,
            LineBreakMode = LineBreakMode.TailTruncation,
            Text = GetDisplayText(item),
            TextColor = Color.FromArgb("#172033"),
            VerticalOptions = LayoutOptions.Center
        };

        var row = new Grid
        {
            Padding = new Thickness(20, 0),
            HeightRequest = ItemHeight,
            BackgroundColor = isSelected ? Color.FromArgb("#F3F4F6") : Colors.White,
            Children = { label }
        };

        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) =>
        {
            SelectedItem = item;
            SetOpen(false);
        };
        row.GestureRecognizers.Add(tap);

        return row;
    }

    private double GetPopupWidth()
    {
        if (Width > 0)
            return Math.Min(Width, DefaultDropdownWidth);

        return DefaultDropdownWidth;
    }
}
