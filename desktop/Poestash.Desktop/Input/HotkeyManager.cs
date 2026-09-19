using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace Poestash.Desktop.Input;

public class HotkeyManager : IDisposable
{
    private const int WM_HOTKEY = 0x0312;
    private const int HOTKEY_ID = 9001;

    public const uint MOD_ALT = 0x0001;
    public const uint MOD_CONTROL = 0x0002;
    public const uint MOD_SHIFT = 0x0004;
    public const uint MOD_WIN = 0x0008;
    public const uint MOD_NOREPEAT = 0x4000;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    private readonly HotkeyWindow _window;
    private bool _isRegistered;
    private bool _isDisposed;

    public event Action? HotkeyPressed;

    public string CurrentHotkey { get; private set; } = string.Empty;

    public HotkeyManager()
    {
        _window = new HotkeyWindow(OnHotKeyTriggered);
    }

    private void OnHotKeyTriggered()
    {
        HotkeyPressed?.Invoke();
    }

    /// <summary>
    /// Registers a global hotkey from a human-readable combination string (e.g. "Ctrl+Shift+A").
    /// </summary>
    public bool Register(string hotkeyString, out string? errorMessage)
    {
        errorMessage = null;

        if (string.IsNullOrWhiteSpace(hotkeyString))
        {
            errorMessage = "Hotkey expression cannot be empty.";
            return false;
        }

        var parsed = ParseHotkey(hotkeyString);
        if (parsed == null)
        {
            errorMessage = $"Invalid hotkey combination: '{hotkeyString}'. Format example: 'Ctrl+Shift+A'.";
            return false;
        }

        Unregister();

        var success = RegisterHotKey(
            _window.Handle,
            HOTKEY_ID,
            parsed.Value.Modifiers | MOD_NOREPEAT,
            parsed.Value.VirtualKey);

        if (!success)
        {
            var errCode = Marshal.GetLastWin32Error();
            errorMessage = $"Failed to register global hotkey '{hotkeyString}' (Win32 Error: {errCode}). It may already be in use by another application.";
            return false;
        }

        _isRegistered = true;
        CurrentHotkey = hotkeyString;
        return true;
    }

    public void Unregister()
    {
        if (_isRegistered && _window.Handle != IntPtr.Zero)
        {
            try
            {
                UnregisterHotKey(_window.Handle, HOTKEY_ID);
            }
            catch {}
            _isRegistered = false;
            CurrentHotkey = string.Empty;
        }
    }

    /// <summary>
    /// Parses a string like "Ctrl+Shift+A", "Alt+D", or "F5" into Win32 modifiers and virtual key code.
    /// </summary>
    public static (uint Modifiers, uint VirtualKey)? ParseHotkey(string hotkeyStr)
    {
        if (string.IsNullOrWhiteSpace(hotkeyStr)) return null;

        var tokens = hotkeyStr.Split(['+', '-'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (tokens.Length == 0) return null;

        uint modifiers = 0;
        uint virtualKey = 0;

        foreach (var rawToken in tokens)
        {
            var token = rawToken.ToUpperInvariant();
            switch (token)
            {
                case "CTRL":
                case "CONTROL":
                    modifiers |= MOD_CONTROL;
                    break;
                case "SHIFT":
                    modifiers |= MOD_SHIFT;
                    break;
                case "ALT":
                    modifiers |= MOD_ALT;
                    break;
                case "WIN":
                case "WINDOWS":
                    modifiers |= MOD_WIN;
                    break;
                default:
                    // Primary key parsing
                    if (Enum.TryParse<Keys>(token, true, out var key))
                    {
                        virtualKey = (uint)key;
                    }
                    else if (token.Length == 1 && token[0] >= 'A' && token[0] <= 'Z')
                    {
                        virtualKey = (uint)token[0];
                    }
                    else if (token.Length == 1 && token[0] >= '0' && token[0] <= '9')
                    {
                        virtualKey = (uint)token[0];
                    }
                    else
                    {
                        return null; // Unknown key token
                    }
                    break;
            }
        }

        if (virtualKey == 0) return null;
        return (modifiers, virtualKey);
    }

    public void Dispose()
    {
        if (!_isDisposed)
        {
            Unregister();
            _window.DestroyHandle();
            _isDisposed = true;
        }
        GC.SuppressFinalize(this);
    }

    private sealed class HotkeyWindow : NativeWindow
    {
        private readonly Action _onHotKey;

        public HotkeyWindow(Action onHotKey)
        {
            _onHotKey = onHotKey;
            CreateHandle(new CreateParams
            {
                Caption = "POESTASH_HotkeyReceiver",
                Style = 0
            });
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_ID)
            {
                _onHotKey();
                return;
            }
            base.WndProc(ref m);
        }
    }
}
