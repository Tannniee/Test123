using System.Windows.Forms;

namespace Poestash.Desktop.Input;

public class ClipboardService
{
    private readonly TimeSpan _defaultTimeout;

    public ClipboardService(TimeSpan? defaultTimeout = null)
    {
        _defaultTimeout = defaultTimeout ?? TimeSpan.FromMilliseconds(300);
    }

    /// <summary>
    /// Captures the hovered item from the active PoE window by sending Ctrl+C and reading the clipboard.
    /// </summary>
    public async Task<string?> CaptureItemFromPoeAsync(CancellationToken ct = default)
    {
        // 1. Clear clipboard before sending copy
        await ClearClipboardSafeAsync().ConfigureAwait(false);

        // 2. Small delay to ensure clean state before copy input
        await Task.Delay(20, ct).ConfigureAwait(false);

        // 3. Send Ctrl+C
        var sent = InputSender.SendCtrlC();
        if (!sent)
        {
            return null;
        }

        // 4. Poll for clipboard text arrival
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        while (stopwatch.Elapsed < _defaultTimeout && !ct.IsCancellationRequested)
        {
            await Task.Delay(25, ct).ConfigureAwait(false);

            var text = await GetClipboardTextSafeAsync().ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(text) && IsPoeItemText(text))
            {
                return text.Trim();
            }
        }

        return null;
    }

    /// <summary>
    /// Pure validation helper to detect whether text matches Path of Exile clipboard item format.
    /// </summary>
    public static bool IsPoeItemText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        var trimmed = text.Trim();

        int score = 0;
        if (trimmed.Contains("Item Class:", StringComparison.OrdinalIgnoreCase)) score += 2;
        if (trimmed.Contains("Rarity:", StringComparison.OrdinalIgnoreCase)) score += 2;
        if (trimmed.Contains("--------")) score += 1;
        if (trimmed.Contains("Item Level:", StringComparison.OrdinalIgnoreCase)) score += 1;

        return score >= 2;
    }

    /// <summary>
    /// Safely clears the system clipboard with STA thread assurance and retry logic.
    /// </summary>
    public static async Task ClearClipboardSafeAsync()
    {
        await RunStaAsync(() =>
        {
            for (int i = 0; i < 3; i++)
            {
                try
                {
                    Clipboard.Clear();
                    return true;
                }
                catch
                {
                    Thread.Sleep(10);
                }
            }
            return false;
        }).ConfigureAwait(false);
    }

    /// <summary>
    /// Safely reads text from the system clipboard with STA thread assurance and retry logic.
    /// </summary>
    public static async Task<string?> GetClipboardTextSafeAsync()
    {
        return await RunStaAsync(() =>
        {
            for (int i = 0; i < 3; i++)
            {
                try
                {
                    if (Clipboard.ContainsText())
                    {
                        return Clipboard.GetText();
                    }
                    return null;
                }
                catch
                {
                    Thread.Sleep(10);
                }
            }
            return null;
        }).ConfigureAwait(false);
    }

    /// <summary>
    /// Ensures actions accessing Win32 clipboard run on an STA thread.
    /// </summary>
    private static Task<T> RunStaAsync<T>(Func<T> action)
    {
        if (Thread.CurrentThread.GetApartmentState() == ApartmentState.STA)
        {
            try
            {
                return Task.FromResult(action());
            }
            catch (Exception ex)
            {
                return Task.FromException<T>(ex);
            }
        }

        var tcs = new TaskCompletionSource<T>();
        var thread = new Thread(() =>
        {
            try
            {
                tcs.SetResult(action());
            }
            catch (Exception ex)
            {
                tcs.SetException(ex);
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.IsBackground = true;
        thread.Start();
        return tcs.Task;
    }
}
