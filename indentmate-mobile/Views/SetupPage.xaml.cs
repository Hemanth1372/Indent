#if WINDOWS
using Microsoft.UI;
using Microsoft.UI.Xaml.Controls;
using WinUISolidColorBrush = Microsoft.UI.Xaml.Media.SolidColorBrush;
#endif
using MauiColor = Microsoft.Maui.Graphics.Color;

namespace IndentMate.Mobile.Views;

public partial class SetupPage : ContentPage
{
    private const string LoadingSpinnerAnimationName = "SetupLoadingSpinnerAnimation";

    public SetupPage()
    {
        InitializeComponent();
        SetupLoadingSpinner.Drawable = new BrandLoadingSpinnerDrawable();

#if WINDOWS
        EnvironmentPicker.HandlerChanged += OnEnvironmentPickerHandlerChanged;
#endif
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        StartLoadingSpinnerAnimation();
    }

    protected override void OnDisappearing()
    {
        SetupLoadingSpinner.AbortAnimation(LoadingSpinnerAnimationName);
        base.OnDisappearing();
    }

    private void StartLoadingSpinnerAnimation()
    {
        SetupLoadingSpinner.AbortAnimation(LoadingSpinnerAnimationName);
        SetupLoadingSpinner.Rotation = 0;

        var animation = new Animation(value => SetupLoadingSpinner.Rotation = value, 0, 360);
        animation.Commit(
            SetupLoadingSpinner,
            LoadingSpinnerAnimationName,
            rate: 16,
            length: 900,
            easing: Easing.Linear,
            finished: (_, wasCancelled) =>
            {
                if (!wasCancelled)
                {
                    StartLoadingSpinnerAnimation();
                }
            });
    }

#if WINDOWS
    private void OnEnvironmentPickerHandlerChanged(object? sender, EventArgs e)
    {
        if (EnvironmentPicker.Handler?.PlatformView is not ComboBox comboBox)
        {
            return;
        }

        var orange = new WinUISolidColorBrush(ColorHelper.FromArgb(255, 247, 147, 30));
        var navy = new WinUISolidColorBrush(ColorHelper.FromArgb(255, 9, 39, 89));

        SetBrush(comboBox, "ComboBoxItemBackgroundSelected", orange);
        SetBrush(comboBox, "ComboBoxItemBackgroundSelectedPointerOver", orange);
        SetBrush(comboBox, "ComboBoxItemBackgroundSelectedPressed", orange);
        SetBrush(comboBox, "ComboBoxItemForegroundSelected", navy);
        SetBrush(comboBox, "ComboBoxItemForegroundSelectedPointerOver", navy);
        SetBrush(comboBox, "ComboBoxItemForegroundSelectedPressed", navy);

        SetBrush(comboBox, "ComboBoxItemSelectedBackground", orange);
        SetBrush(comboBox, "ComboBoxItemSelectedPointerOverBackground", orange);
        SetBrush(comboBox, "ComboBoxItemSelectedPressedBackground", orange);
        SetBrush(comboBox, "ComboBoxItemSelectedForeground", navy);
        SetBrush(comboBox, "ComboBoxItemSelectedPointerOverForeground", navy);
        SetBrush(comboBox, "ComboBoxItemSelectedPressedForeground", navy);

        SetBrush(comboBox, "SystemControlHighlightAccentBrush", orange);
        SetBrush(comboBox, "SystemControlHighlightListAccentLowBrush", orange);
        SetBrush(comboBox, "SystemControlHighlightListAccentMediumBrush", orange);
        SetBrush(comboBox, "SystemControlHighlightListAccentHighBrush", orange);
    }

    private static void SetBrush(ComboBox comboBox, string key, WinUISolidColorBrush brush)
    {
        comboBox.Resources[key] = brush;
    }
#endif

    private sealed class BrandLoadingSpinnerDrawable : IDrawable
    {
        private static readonly MauiColor[] SegmentColors =
        {
            MauiColor.FromArgb("#522E91"),
            MauiColor.FromArgb("#EC008C"),
            MauiColor.FromArgb("#F7931E"),
            MauiColor.FromArgb("#FDB913")
        };

        public void Draw(ICanvas canvas, RectF dirtyRect)
        {
            var strokeSize = Math.Max(3, dirtyRect.Width * 0.12f);
            var inset = strokeSize / 2;
            var size = Math.Min(dirtyRect.Width, dirtyRect.Height) - strokeSize;
            var left = dirtyRect.Center.X - (size / 2);
            var top = dirtyRect.Center.Y - (size / 2);

            canvas.StrokeSize = strokeSize;
            canvas.StrokeLineCap = LineCap.Round;

            for (var i = 0; i < SegmentColors.Length; i++)
            {
                var startAngle = -90 + (i * 88);
                var endAngle = startAngle + 62;

                canvas.StrokeColor = SegmentColors[i];
                canvas.DrawArc(left + inset, top + inset, size - strokeSize, size - strokeSize, startAngle, endAngle, false, false);
            }
        }
    }

}
