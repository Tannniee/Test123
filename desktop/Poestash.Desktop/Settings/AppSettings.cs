using System.Text.Json.Serialization;

namespace Poestash.Desktop.Settings;

public class AppSettings
{
    [JsonPropertyName("port")]
    public int Port { get; set; } = 3000;

    [JsonPropertyName("host")]
    public string Host { get; set; } = "127.0.0.1";

    [JsonPropertyName("portScanRange")]
    public int PortScanRange { get; set; } = 10;

    [JsonPropertyName("autoOpenBrowserOnLaunch")]
    public bool AutoOpenBrowserOnLaunch { get; set; } = true;

    [JsonPropertyName("quickInspectHotkey")]
    public string QuickInspectHotkey { get; set; } = "Ctrl+Shift+A";

    [JsonPropertyName("startWithWindows")]
    public bool StartWithWindows { get; set; } = false;
}
