using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace Poestash.Desktop.UI;

public class DashboardForm : Form
{
    private readonly AppController _controller;

    private Label _lblStatusPill = null!;
    private Label _lblPortValue = null!;
    private Label _lblUrlValue = null!;
    private Label _lblPidValue = null!;
    private Label _lblClipboardStatus = null!;
    private Button _btnToggleServer = null!;
    private Button _btnOpenWeb = null!;
    private Button _btnMinimizeTaskbar = null!;
    private Button _btnExitApp = null!;
    private System.Windows.Forms.Timer _refreshTimer = null!;

    public DashboardForm(AppController controller)
    {
        _controller = controller;

        InitializeComponent();
        UpdateServerStatus();

        _refreshTimer = new System.Windows.Forms.Timer { Interval = 2000 };
        _refreshTimer.Tick += (_, _) => UpdateServerStatus();
        _refreshTimer.Start();
    }

    private void InitializeComponent()
    {
        Text = "POESTASH — Control Panel v2.0.1";
        Size = new Size(540, 430);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        MaximizeBox = false;
        MinimizeBox = true;
        ShowInTaskbar = true;
        BackColor = Color.FromArgb(18, 20, 29);
        ForeColor = Color.FromArgb(241, 245, 249);
        Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

        // 1. Header Area
        var pnlHeader = new Panel
        {
            Dock = DockStyle.Top,
            Height = 70,
            BackColor = Color.FromArgb(12, 14, 21),
            Padding = new Padding(20, 12, 20, 10)
        };

        var lblTitle = new Label
        {
            Text = "POESTASH COMPANION",
            Font = new Font("Segoe UI", 13f, FontStyle.Bold),
            ForeColor = Color.FromArgb(245, 192, 66),
            Location = new Point(18, 12),
            AutoSize = true
        };

        var lblSubtitle = new Label
        {
            Text = "Bảng điều khiển máy chủ định giá & soi đồ Path of Exile (v2.0.1)",
            Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
            ForeColor = Color.FromArgb(148, 163, 184),
            Location = new Point(20, 38),
            AutoSize = true
        };

        pnlHeader.Controls.AddRange([lblTitle, lblSubtitle]);

        // 2. Main Container Card
        var pnlContent = new Panel
        {
            Location = new Point(20, 85),
            Size = new Size(485, 225),
            BackColor = Color.FromArgb(24, 27, 40),
            Padding = new Padding(16)
        };

        // Status Badge Pill
        _lblStatusPill = new Label
        {
            Location = new Point(16, 14),
            Size = new Size(240, 26),
            Text = "● Server: Đang kiểm tra...",
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(74, 222, 128),
            TextAlign = ContentAlignment.MiddleLeft
        };

        // Port row
        var lblPortTitle = new Label
        {
            Text = "Cổng kết nối (Port):",
            Location = new Point(16, 50),
            AutoSize = true,
            ForeColor = Color.FromArgb(148, 163, 184)
        };

        _lblPortValue = new Label
        {
            Text = "3000",
            Location = new Point(180, 50),
            AutoSize = true,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(56, 189, 248)
        };

        // URL row
        var lblUrlTitle = new Label
        {
            Text = "Địa chỉ Web (URL):",
            Location = new Point(16, 80),
            AutoSize = true,
            ForeColor = Color.FromArgb(148, 163, 184)
        };

        _lblUrlValue = new Label
        {
            Text = "http://127.0.0.1:3000",
            Location = new Point(180, 80),
            AutoSize = true,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(245, 192, 66),
            Cursor = Cursors.Hand
        };
        _lblUrlValue.Click += (_, _) => _controller.OpenWebUi();

        // PID row
        var lblPidTitle = new Label
        {
            Text = "Tiến trình (PID):",
            Location = new Point(16, 110),
            AutoSize = true,
            ForeColor = Color.FromArgb(148, 163, 184)
        };

        _lblPidValue = new Label
        {
            Text = "-",
            Location = new Point(180, 110),
            AutoSize = true,
            ForeColor = Color.FromArgb(203, 213, 225)
        };

        // In-game monitor status row
        var lblClipboardTitle = new Label
        {
            Text = "Theo dõi Clipboard PoE:",
            Location = new Point(16, 140),
            AutoSize = true,
            ForeColor = Color.FromArgb(148, 163, 184)
        };

        _lblClipboardStatus = new Label
        {
            Text = "● Đang bật (Ctrl+Alt+C / Ctrl+C ingame)",
            Location = new Point(180, 140),
            AutoSize = true,
            ForeColor = Color.FromArgb(74, 222, 128)
        };

        // Action Buttons inside card: Toggle Server + Open Web
        _btnToggleServer = new Button
        {
            Text = "⏹ Dừng Server (Stop)",
            Location = new Point(16, 175),
            Size = new Size(180, 36),
            BackColor = Color.FromArgb(220, 38, 38),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        _btnToggleServer.FlatAppearance.BorderSize = 0;
        _btnToggleServer.Click += async (_, _) => await ToggleServerAsync();

        _btnOpenWeb = new Button
        {
            Text = "🌐 Mở Web App",
            Location = new Point(210, 175),
            Size = new Size(180, 36),
            BackColor = Color.FromArgb(202, 138, 4),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        _btnOpenWeb.FlatAppearance.BorderSize = 0;
        _btnOpenWeb.Click += (_, _) => _controller.OpenWebUi();

        pnlContent.Controls.AddRange([
            _lblStatusPill,
            lblPortTitle, _lblPortValue,
            lblUrlTitle, _lblUrlValue,
            lblPidTitle, _lblPidValue,
            lblClipboardTitle, _lblClipboardStatus,
            _btnToggleServer, _btnOpenWeb
        ]);

        // 3. Bottom Action Bar (Minimize & Complete Exit)
        _btnMinimizeTaskbar = new Button
        {
            Text = "🔽 Thu nhỏ xuống Taskbar",
            Location = new Point(20, 325),
            Size = new Size(220, 42),
            BackColor = Color.FromArgb(39, 45, 62),
            ForeColor = Color.FromArgb(241, 245, 249),
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        _btnMinimizeTaskbar.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
        _btnMinimizeTaskbar.Click += (_, _) =>
        {
            WindowState = FormWindowState.Minimized;
        };

        _btnExitApp = new Button
        {
            Text = "❌ Thoát hoàn toàn (Exit)",
            Location = new Point(265, 325),
            Size = new Size(240, 42),
            BackColor = Color.FromArgb(153, 27, 27),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        _btnExitApp.FlatAppearance.BorderSize = 0;
        _btnExitApp.Click += (_, _) =>
        {
            _isShuttingDown = true;
            _refreshTimer.Stop();
            _controller.Shutdown();
        };

        Controls.AddRange([
            pnlHeader,
            pnlContent,
            _btnMinimizeTaskbar,
            _btnExitApp
        ]);
    }

    private bool _isShuttingDown;

    private void UpdateServerStatus()
    {
        var isRunning = _controller.IsServerRunning;
        var port = _controller.ActivePort;
        var url = _controller.ActiveServerUrl;
        var pid = _controller.ServerPid;

        _lblPortValue.Text = port.ToString();
        _lblUrlValue.Text = url;
        _lblPidValue.Text = pid.HasValue ? pid.Value.ToString() : "- (Đã dừng)";

        if (isRunning)
        {
            _lblStatusPill.Text = $"● Máy chủ: Đang chạy (Port {port})";
            _lblStatusPill.ForeColor = Color.FromArgb(74, 222, 128);

            _btnToggleServer.Text = "⏹ Tắt / Dừng Server (End)";
            _btnToggleServer.BackColor = Color.FromArgb(185, 28, 28);
            _btnOpenWeb.Enabled = true;
        }
        else
        {
            _lblStatusPill.Text = "○ Máy chủ: Đã tắt / dừng (Stopped)";
            _lblStatusPill.ForeColor = Color.FromArgb(239, 68, 68);

            _btnToggleServer.Text = "▶ Bật / Khởi động Server (Start)";
            _btnToggleServer.BackColor = Color.FromArgb(16, 185, 129);
            _btnOpenWeb.Enabled = false;
        }
    }

    private async Task ToggleServerAsync()
    {
        _btnToggleServer.Enabled = false;
        try
        {
            if (_controller.IsServerRunning)
            {
                await _controller.StopServerAsync();
            }
            else
            {
                await _controller.StartServerAsync();
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Lỗi khi thay đổi trạng thái máy chủ:\n{ex.Message}",
                "POESTASH Server Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
        finally
        {
            _btnToggleServer.Enabled = true;
            UpdateServerStatus();
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (_isShuttingDown)
        {
            base.OnFormClosing(e);
            return;
        }

        if (e.CloseReason == CloseReason.UserClosing)
        {
            var result = MessageBox.Show(
                "Bạn muốn tắt hẳn ứng dụng hay chỉ thu nhỏ xuống khay hệ thống?\n\n" +
                "- Chọn YES: Thoát hoàn toàn (Dừng server & tắt ứng dụng).\n" +
                "- Chọn NO: Thu nhỏ vào khay hệ thống (Tiếp tục chạy ngầm).\n" +
                "- Chọn CANCEL: Giữ nguyên cửa sổ.",
                "POESTASH — Thoát ứng dụng",
                MessageBoxButtons.YesNoCancel,
                MessageBoxIcon.Question);

            if (result == DialogResult.Yes)
            {
                _isShuttingDown = true;
                _refreshTimer.Stop();
                _controller.Shutdown();
                return;
            }
            else if (result == DialogResult.No)
            {
                e.Cancel = true;
                WindowState = FormWindowState.Minimized;
                Hide();
                return;
            }
            else
            {
                e.Cancel = true;
                return;
            }
        }

        _refreshTimer.Stop();
        base.OnFormClosing(e);
    }
}
