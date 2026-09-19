using System.Diagnostics;
using System.Windows.Forms;
using Poestash.Desktop.Bridge;
using Poestash.Desktop.Game;
using Poestash.Desktop.Input;
using Poestash.Desktop.Server;
using Poestash.Desktop.Settings;
using Poestash.Desktop.UI;

namespace Poestash.Desktop;

public class AppController : IDisposable
{
    private const string SingleInstanceMutexName = "POESTASH_DESKTOP_SINGLE_INSTANCE";

    private Mutex? _singleInstanceMutex;
    private readonly SettingsStore _settingsStore;
    private readonly HealthClient _healthClient;
    private readonly PortResolver _portResolver;
    private readonly ServerManager _serverManager;
    private readonly BridgeClient _bridgeClient;
    private readonly PoeDetector _poeDetector;
    private readonly ClipboardService _clipboardService;
    private readonly HotkeyManager _hotkeyManager;
    private readonly ClipboardMonitor _clipboardMonitor;

    private AppSettings? _settings;
    private TrayManager? _trayManager;
    private string _activeHost = "127.0.0.1";
    private int _activePort = 3000;
    private string _activeServerUrl = "http://127.0.0.1:3000";
    private bool _isDisposed;

    public AppController()
    {
        _settingsStore = new SettingsStore();
        _healthClient = new HealthClient();
        _portResolver = new PortResolver();
        _serverManager = new ServerManager(_healthClient);
        _bridgeClient = new BridgeClient();
        _poeDetector = new PoeDetector();
        _clipboardService = new ClipboardService();
        _hotkeyManager = new HotkeyManager();
        _clipboardMonitor = new ClipboardMonitor(_poeDetector);
        _clipboardMonitor.PoeItemDetected += OnPassivePoeItemDetected;
    }

    public async Task<bool> InitializeAsync()
    {
        // 1. Single Instance Check via Named Mutex
        _singleInstanceMutex = new Mutex(true, SingleInstanceMutexName, out var isOnlyInstance);
        if (!isOnlyInstance)
        {
            MessageBox.Show(
                "POESTASH is already running in the system tray.",
                "POESTASH",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);

            // Attempt to open the default web companion for convenience
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "http://127.0.0.1:3000",
                    UseShellExecute = true
                });
            }
            catch {}

            return false;
        }

        // 2. Load Persisted Settings
        _settings = _settingsStore.LoadSettings();

        // 3. Resolve Port & Detect Existing POESTASH Server
        var resolution = await _portResolver.ResolvePortAsync(
            _settings.Host,
            _settings.Port,
            _settings.PortScanRange,
            _healthClient).ConfigureAwait(true);

        if (resolution.Mode == PortResolutionMode.AllPortsExhausted)
        {
            MessageBox.Show(
                resolution.ErrorMessage ?? "All local ports in the configured range are occupied.",
                "POESTASH Startup Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return false;
        }

        _activeHost = resolution.Host;
        _activePort = resolution.Port;
        _activeServerUrl = $"http://{resolution.Host}:{resolution.Port}";

        // 4. Start Server or Reuse Existing
        if (resolution.Mode == PortResolutionMode.ReuseExistingServer)
        {
            Debug.WriteLine($"[AppController] Reusing existing POESTASH server at {_activeServerUrl}");
        }
        else
        {
            try
            {
                await _serverManager.StartAsync(resolution.Host, resolution.Port).ConfigureAwait(true);
                Debug.WriteLine($"[AppController] Node server started at {_activeServerUrl}");
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Failed to start POESTASH background server:\n{ex.Message}",
                    "POESTASH Startup Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return false;
            }
        }

        // 5. Register Global Hotkey
        if (!string.IsNullOrWhiteSpace(_settings.QuickInspectHotkey))
        {
            if (_hotkeyManager.Register(_settings.QuickInspectHotkey, out var err))
            {
                Debug.WriteLine($"[AppController] Registered global hotkey: {_settings.QuickInspectHotkey}");
            }
            else
            {
                Debug.WriteLine($"[AppController] Warning registering hotkey: {err}");
            }
        }
        _hotkeyManager.HotkeyPressed += OnQuickInspectTriggered;

        // 6. Initialize System Tray
        _trayManager = new TrayManager(
            _activeServerUrl,
            _settings,
            _settingsStore,
            Shutdown,
            OnQuickInspectTriggered);

        // 7. Open Web UI if configured
        if (_settings.AutoOpenBrowserOnLaunch)
        {
            _trayManager.OpenWebUi();
        }

        _trayManager.ShowNotification(
            "POESTASH Ready",
            $"Running locally on port {resolution.Port}. Hotkey: {_settings.QuickInspectHotkey}",
            ToolTipIcon.Info);

        return true;
    }

    /// <summary>
    /// Handles the Quick Inspect hotkey trigger or manual tray request.
    /// </summary>
    public async void OnQuickInspectTriggered()
    {
        try
        {
            // 1. Check if Path of Exile is the active foreground window
            var poeInfo = _poeDetector.GetForegroundPoeWindow();
            if (!poeInfo.IsPoeForeground)
            {
                Debug.WriteLine("[AppController] Hotkey pressed but PoE is not active foreground window. Ignoring.");
                return;
            }

            // 2. Capture item text from PoE via Ctrl+C simulation and clipboard
            var rawText = await _clipboardService.CaptureItemFromPoeAsync().ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(rawText))
            {
                Debug.WriteLine("[AppController] No valid PoE item text captured.");
                return;
            }

            // 3. Send to Node.js backend bridge
            var response = await SendInspectAsync(rawText, poeInfo.GameVersion).ConfigureAwait(false);
            if (response.Success)
            {
                _trayManager?.ShowNotification(
                    "POESTASH Quick Inspect",
                    $"Item broadcasted to Web UI ({poeInfo.GameVersion.ToUpperInvariant()})",
                    ToolTipIcon.Info);
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[AppController] Error during quick inspect: {ex.Message}");
        }
    }

    /// <summary>
    /// Handles passive clipboard detection when Path of Exile copies an item (e.g. via native Ctrl+Alt+C or Ctrl+C).
    /// </summary>
    private async void OnPassivePoeItemDetected(string rawText)
    {
        if (_settings?.AutoClipboardMonitoring == false)
        {
            return;
        }

        try
        {
            var poeInfo = _poeDetector.GetForegroundPoeWindow();
            var gameVersion = poeInfo.GameVersion;

            var response = await SendInspectAsync(rawText, gameVersion).ConfigureAwait(false);
            if (response.Success)
            {
                Debug.WriteLine($"[AppController] In-game clipboard item broadcasted to Web UI ({gameVersion})");
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[AppController] Error during passive clipboard inspect: {ex.Message}");
        }
    }

    /// <summary>
    /// Sends an item payload to the local Node.js bridge server to broadcast via SSE to connected web companions.
    /// </summary>
    public async Task<BridgeInspectResponse> SendInspectAsync(
        string rawText,
        string game = "poe1",
        CancellationToken ct = default)
    {
        return await _bridgeClient.SendInspectAsync(_activeHost, _activePort, rawText, game, ct).ConfigureAwait(false);
    }

    /// <summary>
    /// Queries the current bridge status from the local server.
    /// </summary>
    public async Task<BridgeStatusResponse?> GetBridgeStatusAsync(CancellationToken ct = default)
    {
        return await _bridgeClient.GetStatusAsync(_activeHost, _activePort, ct).ConfigureAwait(false);
    }

    public void Shutdown()
    {
        Dispose();
        Application.Exit();
    }

    public void Dispose()
    {
        if (!_isDisposed)
        {
            _clipboardMonitor.Dispose();
            _hotkeyManager.Dispose();
            _trayManager?.Dispose();
            _trayManager = null;

            _serverManager.Dispose();
            _healthClient.Dispose();
            _bridgeClient.Dispose();

            if (_singleInstanceMutex != null)
            {
                try
                {
                    _singleInstanceMutex.ReleaseMutex();
                }
                catch {}
                _singleInstanceMutex.Dispose();
                _singleInstanceMutex = null;
            }

            _isDisposed = true;
        }
        GC.SuppressFinalize(this);
    }
}
