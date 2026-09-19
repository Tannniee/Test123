using System.Text.Json;

namespace Poestash.Desktop.Settings;

public class SettingsStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    public string SettingsDirectory { get; }
    public string SettingsFilePath { get; }

    public SettingsStore()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        SettingsDirectory = Path.Combine(appData, "POESTASH");
        SettingsFilePath = Path.Combine(SettingsDirectory, "settings.json");
    }

    public AppSettings LoadSettings()
    {
        try
        {
            if (File.Exists(SettingsFilePath))
            {
                var json = File.ReadAllText(SettingsFilePath);
                var settings = JsonSerializer.Deserialize<AppSettings>(json, JsonOptions);
                if (settings != null) return settings;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SettingsStore] Failed to load settings: {ex.Message}");
        }

        var defaultSettings = new AppSettings();
        SaveSettings(defaultSettings);
        return defaultSettings;
    }

    public void SaveSettings(AppSettings settings)
    {
        try
        {
            if (!Directory.Exists(SettingsDirectory))
            {
                Directory.CreateDirectory(SettingsDirectory);
            }

            var json = JsonSerializer.Serialize(settings, JsonOptions);
            var tempPath = $"{SettingsFilePath}.{Guid.NewGuid():N}.tmp";
            File.WriteAllText(tempPath, json);
            File.Move(tempPath, SettingsFilePath, overwrite: true);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SettingsStore] Failed to save settings: {ex.Message}");
        }
    }
}
