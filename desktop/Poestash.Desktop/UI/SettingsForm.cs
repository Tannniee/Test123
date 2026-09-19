using System.Drawing;
using System.Windows.Forms;
using Poestash.Desktop.Settings;

namespace Poestash.Desktop.UI;

public class SettingsForm : Form
{
    private readonly AppSettings _settings;
    private readonly SettingsStore _store;
    private readonly string _currentUrl;

    private NumericUpDown _numPort = null!;
    private NumericUpDown _numRange = null!;
    private CheckBox _chkAutoOpen = null!;
    private Label _lblStatus = null!;

    public SettingsForm(AppSettings settings, SettingsStore store, string currentUrl)
    {
        _settings = settings;
        _store = store;
        _currentUrl = currentUrl;

        InitializeComponent();
    }

    private void InitializeComponent()
    {
        Text = "POESTASH — Settings";
        Size = new Size(420, 340);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        MaximizeBox = false;
        MinimizeBox = false;
        ShowInTaskbar = true;
        BackColor = Color.FromArgb(24, 24, 27);
        ForeColor = Color.FromArgb(244, 244, 245);
        Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

        var lblTitle = new Label
        {
            Text = "POESTASH Companion Settings",
            Font = new Font("Segoe UI", 12f, FontStyle.Bold),
            ForeColor = Color.FromArgb(250, 204, 21),
            Location = new Point(20, 16),
            AutoSize = true
        };

        var lblPort = new Label
        {
            Text = "Preferred Local Port:",
            Location = new Point(20, 60),
            AutoSize = true
        };

        _numPort = new NumericUpDown
        {
            Minimum = 1024,
            Maximum = 65535,
            Value = _settings.Port,
            Location = new Point(200, 58),
            Width = 100,
            BackColor = Color.FromArgb(39, 39, 42),
            ForeColor = Color.White
        };

        var lblRange = new Label
        {
            Text = "Conflict Scan Range:",
            Location = new Point(20, 95),
            AutoSize = true
        };

        _numRange = new NumericUpDown
        {
            Minimum = 1,
            Maximum = 50,
            Value = _settings.PortScanRange,
            Location = new Point(200, 93),
            Width = 100,
            BackColor = Color.FromArgb(39, 39, 42),
            ForeColor = Color.White
        };

        var lblHotkey = new Label
        {
            Text = "Quick Inspect Hotkey:",
            Location = new Point(20, 130),
            AutoSize = true
        };

        var txtHotkey = new TextBox
        {
            Text = _settings.QuickInspectHotkey,
            Location = new Point(200, 128),
            Width = 140,
            BackColor = Color.FromArgb(39, 39, 42),
            ForeColor = Color.White
        };

        _chkAutoOpen = new CheckBox
        {
            Text = "Auto-open web companion in browser on launch",
            Checked = _settings.AutoOpenBrowserOnLaunch,
            Location = new Point(20, 165),
            Width = 360,
            AutoSize = true
        };

        _lblStatus = new Label
        {
            Text = $"Active Server: {_currentUrl}",
            Location = new Point(20, 200),
            ForeColor = Color.FromArgb(161, 161, 170),
            AutoSize = true
        };

        var btnSave = new Button
        {
            Text = "Save Changes",
            DialogResult = DialogResult.OK,
            Location = new Point(190, 240),
            Size = new Size(110, 32),
            BackColor = Color.FromArgb(37, 99, 235),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat
        };
        btnSave.Click += (_, _) => OnSave(txtHotkey.Text);

        var btnCancel = new Button
        {
            Text = "Cancel",
            DialogResult = DialogResult.Cancel,
            Location = new Point(310, 240),
            Size = new Size(80, 32),
            BackColor = Color.FromArgb(63, 63, 70),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat
        };

        Controls.AddRange([
            lblTitle,
            lblPort,
            _numPort,
            lblRange,
            _numRange,
            lblHotkey,
            txtHotkey,
            _chkAutoOpen,
            _lblStatus,
            btnSave,
            btnCancel
        ]);

        AcceptButton = btnSave;
        CancelButton = btnCancel;
    }

    private void OnSave(string hotkeyText)
    {
        _settings.Port = (int)_numPort.Value;
        _settings.PortScanRange = (int)_numRange.Value;
        _settings.AutoOpenBrowserOnLaunch = _chkAutoOpen.Checked;
        if (!string.IsNullOrWhiteSpace(hotkeyText))
        {
            _settings.QuickInspectHotkey = hotkeyText.Trim();
        }
        _store.SaveSettings(_settings);
        Close();
    }
}
