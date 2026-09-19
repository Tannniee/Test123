using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using Poestash.Desktop.Settings;

namespace Poestash.Desktop.UI;

public class TrayManager : IDisposable
{
    private readonly NotifyIcon _notifyIcon;
    private readonly ContextMenuStrip _contextMenu;
    private readonly AppSettings _settings;
    private readonly SettingsStore _store;
    private readonly string _serverUrl;
    private readonly Action _onExitRequested;
    private readonly Action? _onQuickInspectRequested;

    public TrayManager(
        string serverUrl,
        AppSettings settings,
        SettingsStore store,
        Action onExitRequested,
        Action? onQuickInspectRequested = null)
    {
        _serverUrl = serverUrl;
        _settings = settings;
        _store = store;
        _onExitRequested = onExitRequested;
        _onQuickInspectRequested = onQuickInspectRequested;

        _contextMenu = new ContextMenuStrip();
        _notifyIcon = new NotifyIcon
        {
            Text = "POESTASH — Local Price Companion",
            Icon = CreatePoestashIcon(),
            Visible = true,
            ContextMenuStrip = _contextMenu
        };

        _notifyIcon.DoubleClick += (_, _) => OpenWebUi();
        BuildContextMenu();
    }

    private void BuildContextMenu()
    {
        _contextMenu.Items.Clear();

        // Header Item (App Title & Status)
        var titleItem = new ToolStripMenuItem("POESTASH v2.0.1")
        {
            Enabled = false,
            Font = new Font("Segoe UI", 9f, FontStyle.Bold)
        };

        // 2. Server Status
        var statusItem = new ToolStripMenuItem($"● Server: Online ({_serverUrl})")
        {
            Enabled = false,
            ForeColor = Color.FromArgb(34, 197, 94)
        };

        // 3. Open Web UI (Default Action)
        var openItem = new ToolStripMenuItem("Open POESTASH Web UI", null, (_, _) => OpenWebUi())
        {
            Font = new Font("Segoe UI", 9f, FontStyle.Bold)
        };

        // 4. Quick Inspect (Phase 5)
        var quickInspectText = string.IsNullOrWhiteSpace(_settings.QuickInspectHotkey)
            ? "Quick Inspect"
            : $"Quick Inspect ({_settings.QuickInspectHotkey})";

        var quickInspectItem = new ToolStripMenuItem(quickInspectText, null, (_, _) => _onQuickInspectRequested?.Invoke())
        {
            Enabled = _onQuickInspectRequested != null
        };

        // 5. Settings
        var settingsItem = new ToolStripMenuItem("Settings...", null, (_, _) => OpenSettings());

        // 6. Exit
        var exitItem = new ToolStripMenuItem("Exit", null, (_, _) => _onExitRequested());

        _contextMenu.Items.AddRange([
            titleItem,
            statusItem,
            new ToolStripSeparator(),
            openItem,
            quickInspectItem,
            settingsItem,
            new ToolStripSeparator(),
            exitItem
        ]);
    }

    public void OpenWebUi()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = _serverUrl,
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Failed to open browser: {ex.Message}\nURL: {_serverUrl}",
                "POESTASH",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
        }
    }

    private void OpenSettings()
    {
        using var form = new SettingsForm(_settings, _store, _serverUrl);
        if (form.ShowDialog() == DialogResult.OK)
        {
            BuildContextMenu();
        }
    }

    public void ShowNotification(string title, string message, ToolTipIcon icon = ToolTipIcon.Info)
    {
        _notifyIcon.ShowBalloonTip(3000, title, message, icon);
    }

    private static Icon CreatePoestashIcon()
    {
        // Programmatically generate a sharp, high-DPI gold PoE diamond icon
        using var bmp = new Bitmap(32, 32);
        using var g = Graphics.FromImage(bmp);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Color.Transparent);

        // Draw diamond path
        Point[] diamond = [
            new Point(16, 2),
            new Point(30, 16),
            new Point(16, 30),
            new Point(2, 16)
        ];

        using var brush = new LinearGradientBrush(
            new Rectangle(0, 0, 32, 32),
            Color.FromArgb(245, 158, 11),
            Color.FromArgb(180, 83, 9),
            LinearGradientMode.ForwardDiagonal);

        g.FillPolygon(brush, diamond);

        using var pen = new Pen(Color.FromArgb(254, 240, 138), 2f);
        g.DrawPolygon(pen, diamond);

        // Inner highlight
        Point[] inner = [
            new Point(16, 8),
            new Point(24, 16),
            new Point(16, 24),
            new Point(8, 16)
        ];
        using var innerPen = new Pen(Color.FromArgb(255, 255, 255, 180), 1f);
        g.DrawPolygon(innerPen, inner);

        var hIcon = bmp.GetHicon();
        return (Icon)Icon.FromHandle(hIcon).Clone();
    }

    public void Dispose()
    {
        _notifyIcon.Visible = false;
        _notifyIcon.Dispose();
        _contextMenu.Dispose();
        GC.SuppressFinalize(this);
    }
}
