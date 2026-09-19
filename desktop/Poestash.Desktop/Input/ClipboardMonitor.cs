using System.Runtime.InteropServices;
using System.Windows.Forms;
using Poestash.Desktop.Game;

namespace Poestash.Desktop.Input;

/// <summary>
/// Passive clipboard listener that detects when Path of Exile copies an item to clipboard (e.g. via Ctrl+Alt+C or Ctrl+C).
/// </summary>
public class ClipboardMonitor : IDisposable
{
    private const int WM_CLIPBOARDUPDATE = 0x031D;

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AddClipboardFormatListener(IntPtr hwnd);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool RemoveClipboardFormatListener(IntPtr hwnd);

    private readonly PoeDetector _poeDetector;
    private readonly ClipboardWindow _window;
    private string? _lastItemText;
    private DateTime _lastProcessedTime = DateTime.MinValue;
    private bool _isDisposed;

    public event Action<string>? PoeItemDetected;

    public ClipboardMonitor(PoeDetector poeDetector)
    {
        _poeDetector = poeDetector;
        _window = new ClipboardWindow(OnClipboardUpdate);
        if (_window.Handle != IntPtr.Zero)
        {
            AddClipboardFormatListener(_window.Handle);
        }
    }

    private async void OnClipboardUpdate()
    {
        try
        {
            // 1. Check if Path of Exile is active foreground window
            var poeInfo = _poeDetector.GetForegroundPoeWindow();
            if (!poeInfo.IsPoeForeground)
            {
                return;
            }

            // 2. Read clipboard safe
            var text = await ClipboardService.GetClipboardTextSafeAsync().ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(text) || !ClipboardService.IsPoeItemText(text))
            {
                return;
            }

            var trimmed = text.Trim();

            // 3. Deduplicate consecutive identical clipboards within 1.5 seconds
            var now = DateTime.UtcNow;
            if (trimmed == _lastItemText && (now - _lastProcessedTime).TotalSeconds < 1.5)
            {
                return;
            }

            _lastItemText = trimmed;
            _lastProcessedTime = now;

            PoeItemDetected?.Invoke(trimmed);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ClipboardMonitor] Error handling clipboard update: {ex.Message}");
        }
    }

    public void Dispose()
    {
        if (!_isDisposed)
        {
            _isDisposed = true;
            if (_window.Handle != IntPtr.Zero)
            {
                try
                {
                    RemoveClipboardFormatListener(_window.Handle);
                }
                catch {}
            }
            _window.DestroyHandle();
        }
        GC.SuppressFinalize(this);
    }

    private sealed class ClipboardWindow : NativeWindow
    {
        private readonly Action _onUpdate;

        public ClipboardWindow(Action onUpdate)
        {
            _onUpdate = onUpdate;
            CreateHandle(new CreateParams
            {
                Parent = (IntPtr)(-3) // HWND_MESSAGE
            });
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_CLIPBOARDUPDATE)
            {
                _onUpdate();
            }
            base.WndProc(ref m);
        }
    }
}
