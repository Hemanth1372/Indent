namespace IndentMate.Mobile.Controls;

/// <summary>
/// Single reusable Material Icons label. All icon usage in the app goes through this control.
/// </summary>
public class IconLabel : Label
{
    public static readonly BindableProperty GlyphProperty = BindableProperty.Create(
        nameof(Glyph),
        typeof(string),
        typeof(IconLabel),
        string.Empty,
        propertyChanged: (b, _, _) => ((IconLabel)b).Apply());

    public static readonly BindableProperty IconSizeProperty = BindableProperty.Create(
        nameof(IconSize),
        typeof(double),
        typeof(IconLabel),
        22d,
        propertyChanged: (b, _, _) => ((IconLabel)b).Apply());

    public static readonly BindableProperty IconColorProperty = BindableProperty.Create(
        nameof(IconColor),
        typeof(Color),
        typeof(IconLabel),
        null,
        propertyChanged: (b, _, _) => ((IconLabel)b).Apply());

    public string Glyph
    {
        get => (string)GetValue(GlyphProperty);
        set => SetValue(GlyphProperty, value);
    }

    public double IconSize
    {
        get => (double)GetValue(IconSizeProperty);
        set => SetValue(IconSizeProperty, value);
    }

    public Color IconColor
    {
        get => (Color)GetValue(IconColorProperty);
        set => SetValue(IconColorProperty, value);
    }

    public IconLabel()
    {
        FontFamily = "MaterialIcons";
        HorizontalOptions = LayoutOptions.Center;
        VerticalOptions = LayoutOptions.Center;
        HorizontalTextAlignment = TextAlignment.Center;
        VerticalTextAlignment = TextAlignment.Center;
        Apply();
    }

    private void Apply()
    {
        Text = Glyph;
        FontSize = IconSize;
        TextColor = IconColor ?? Color.FromArgb("#1F2937");
    }
}
