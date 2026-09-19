using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace Poestash.Desktop.Game;

public class PoeWindowInfo
{
    public bool IsPoeForeground { get; set; }
    public string GameVersion { get; set; } = "poe1"; // "poe1" or "poe2"
    public string ProcessName { get; set; } = string.Empty;
    public string WindowTitle { get; set; } = string.Empty;
    public IntPtr WindowHandle { get; set; }
}

public class PoeDetector
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    /// <summary>
    /// Checks whether the active foreground window belongs to Path of Exile (1 or 2).
    /// </summary>
    public PoeWindowInfo GetForegroundPoeWindow()
    {
        var hWnd = GetForegroundWindow();
        if (hWnd == IntPtr.Zero)
        {
            return new PoeWindowInfo { IsPoeForeground = false };
        }

        GetWindowThreadProcessId(hWnd, out var processId);
        if (processId == 0)
        {
            return new PoeWindowInfo { IsPoeForeground = false, WindowHandle = hWnd };
        }

        string processName = string.Empty;
        try
        {
            using var proc = Process.GetProcessById((int)processId);
            processName = proc.ProcessName;
        }
        catch
        {
            // Process may have exited or insufficient permissions
        }

        var sb = new StringBuilder(256);
        GetWindowText(hWnd, sb, sb.Capacity);
        var title = sb.ToString();

        var (isPoe, gameVersion) = ClassifyProcess(processName, title);

        return new PoeWindowInfo
        {
            IsPoeForeground = isPoe,
            GameVersion = gameVersion,
            ProcessName = processName,
            WindowTitle = title,
            WindowHandle = hWnd
        };
    }

    /// <summary>
    /// Pure function classifying process name and window title into PoE 1 / PoE 2 status.
    /// Can be tested deterministically without live process handles.
    /// </summary>
    public static (bool IsPoe, string GameVersion) ClassifyProcess(string processName, string windowTitle)
    {
        var pName = (processName ?? string.Empty).Trim();
        var title = (windowTitle ?? string.Empty).Trim();

        // 1. PoE 2 Detection
        if (pName.StartsWith("PathOfExile2", StringComparison.OrdinalIgnoreCase) ||
            title.Contains("Path of Exile 2", StringComparison.OrdinalIgnoreCase))
        {
            return (true, "poe2");
        }

        // 2. PoE 1 Detection
        if (pName.StartsWith("PathOfExile", StringComparison.OrdinalIgnoreCase) ||
            pName.Equals("PathOfExileSteam", StringComparison.OrdinalIgnoreCase) ||
            pName.Equals("PathOfExile_x64", StringComparison.OrdinalIgnoreCase) ||
            pName.Equals("PathOfExile_x64Steam", StringComparison.OrdinalIgnoreCase) ||
            title.StartsWith("Path of Exile", StringComparison.OrdinalIgnoreCase))
        {
            return (true, "poe1");
        }

        return (false, "poe1");
    }
}
