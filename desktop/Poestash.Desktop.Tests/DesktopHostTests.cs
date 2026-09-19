using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Poestash.Desktop.Game;
using Poestash.Desktop.Input;
using Poestash.Desktop.Server;
using Poestash.Desktop.Settings;

namespace Poestash.Desktop.Tests;

[TestClass]
public class DesktopHostTests
{
    [TestMethod]
    public void TestSettingsDefaultsAndSerialization()
    {
        var settings = new AppSettings();
        Assert.AreEqual(3000, settings.Port);
        Assert.AreEqual("127.0.0.1", settings.Host);
        Assert.AreEqual(10, settings.PortScanRange);
        Assert.IsTrue(settings.AutoOpenBrowserOnLaunch);
        Assert.AreEqual("Ctrl+D", settings.QuickInspectHotkey);
        Assert.IsTrue(settings.AutoClipboardMonitoring);
        Assert.IsFalse(settings.StartWithWindows);

        var json = JsonSerializer.Serialize(settings);
        var restored = JsonSerializer.Deserialize<AppSettings>(json);

        Assert.IsNotNull(restored);
        Assert.AreEqual(settings.Port, restored.Port);
        Assert.AreEqual(settings.Host, restored.Host);
        Assert.AreEqual(settings.PortScanRange, restored.PortScanRange);
        Assert.AreEqual(settings.AutoOpenBrowserOnLaunch, restored.AutoOpenBrowserOnLaunch);
    }

    [TestMethod]
    public void TestSettingsStoreSaveAndLoad()
    {
        var store = new SettingsStore();
        var initial = store.LoadSettings();
        Assert.IsNotNull(initial);

        var originalPort = initial.Port;
        initial.Port = 3456;
        store.SaveSettings(initial);

        var reloaded = store.LoadSettings();
        Assert.AreEqual(3456, reloaded.Port);

        // Restore original
        initial.Port = originalPort;
        store.SaveSettings(initial);
    }

    [TestMethod]
    public void TestPortResolverFreePortDetection()
    {
        // Find an open port dynamically
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var freePort = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();

        var isAvailable = PortResolver.IsPortAvailable("127.0.0.1", freePort);
        Assert.IsTrue(isAvailable, "Port should be available immediately after release");
    }

    [TestMethod]
    public void TestPortResolverOccupiedPortDetection()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var occupiedPort = ((IPEndPoint)listener.LocalEndpoint).Port;

        try
        {
            var isAvailable = PortResolver.IsPortAvailable("127.0.0.1", occupiedPort);
            Assert.IsFalse(isAvailable, "Occupied port must be identified as unavailable");
        }
        finally
        {
            listener.Stop();
        }
    }

    [TestMethod]
    public void TestHealthCheckResultClassification()
    {
        var poestashData = new HealthResponse
        {
            Status = "ok",
            Service = "poestash-server",
            Version = "2.0.1",
            Pid = 12345
        };

        var poestashResult = HealthCheckResult.Success("127.0.0.1", 3000, poestashData);
        Assert.IsTrue(poestashResult.IsReachable);
        Assert.IsTrue(poestashResult.IsPoestashService);

        var foreignData = new HealthResponse
        {
            Status = "ok",
            Service = "other-service"
        };

        var foreignResult = HealthCheckResult.Success("127.0.0.1", 3000, foreignData);
        Assert.IsTrue(foreignResult.IsReachable);
        Assert.IsFalse(foreignResult.IsPoestashService, "Non-POESTASH service must not be classified as POESTASH");

        var unreachableResult = HealthCheckResult.Unreachable("127.0.0.1", 3000, "Connection refused");
        Assert.IsFalse(unreachableResult.IsReachable);
        Assert.IsFalse(unreachableResult.IsPoestashService);
    }

    [TestMethod]
    public void TestServerManagerExecutableDiscovery()
    {
        var nodePath = ServerManager.FindNodeExecutable();
        Assert.IsFalse(string.IsNullOrWhiteSpace(nodePath), "Should resolve Node executable or command name");

        var scriptPath = ServerManager.FindServerScript();
        Assert.IsNotNull(scriptPath, "Should locate server.js in repo hierarchy");
        Assert.IsTrue(File.Exists(scriptPath), $"server.js must exist at resolved path: {scriptPath}");
    }

    [TestMethod]
    public void TestBridgeClientSerialization()
    {
        var payload = new Poestash.Desktop.Bridge.InspectPayload
        {
            Game = "poe1",
            Source = "clipboard",
            RawText = "Item Class: Currency\nRarity: Currency\nDivine Orb"
        };

        var json = JsonSerializer.Serialize(payload);
        Assert.IsTrue(json.Contains("\"game\":\"poe1\""));
        Assert.IsTrue(json.Contains("Divine Orb"));

        var responseJson = "{\"success\":true,\"requestId\":\"req_123\",\"clientsNotified\":2}";
        var resp = JsonSerializer.Deserialize<Poestash.Desktop.Bridge.BridgeInspectResponse>(responseJson);
        Assert.IsNotNull(resp);
        Assert.IsTrue(resp.Success);
        Assert.AreEqual("req_123", resp.RequestId);
        Assert.AreEqual(2, resp.ClientsNotified);
    }

    [TestMethod]
    public void TestHotkeyStringParser()
    {
        // 1. Ctrl+Shift+A (Default)
        var parsedA = HotkeyManager.ParseHotkey("Ctrl+Shift+A");
        Assert.IsNotNull(parsedA);
        Assert.AreEqual(HotkeyManager.MOD_CONTROL | HotkeyManager.MOD_SHIFT, parsedA.Value.Modifiers);
        Assert.AreEqual((uint)Keys.A, parsedA.Value.VirtualKey);

        // 2. Alt+D
        var parsedAlt = HotkeyManager.ParseHotkey("Alt+D");
        Assert.IsNotNull(parsedAlt);
        Assert.AreEqual(HotkeyManager.MOD_ALT, parsedAlt.Value.Modifiers);
        Assert.AreEqual((uint)Keys.D, parsedAlt.Value.VirtualKey);

        // 3. F5 (Single key)
        var parsedF5 = HotkeyManager.ParseHotkey("F5");
        Assert.IsNotNull(parsedF5);
        Assert.AreEqual(0u, parsedF5.Value.Modifiers);
        Assert.AreEqual((uint)Keys.F5, parsedF5.Value.VirtualKey);

        // 4. Invalid combinations
        Assert.IsNull(HotkeyManager.ParseHotkey(""));
        Assert.IsNull(HotkeyManager.ParseHotkey("Ctrl+"));
        Assert.IsNull(HotkeyManager.ParseHotkey("UnknownKey123"));
    }

    [TestMethod]
    public void TestPoeProcessClassification()
    {
        // PoE 1 Standalone & Steam
        var (isPoe1, game1) = PoeDetector.ClassifyProcess("PathOfExile", "Path of Exile");
        Assert.IsTrue(isPoe1);
        Assert.AreEqual("poe1", game1);

        var (isPoe1Steam, game1Steam) = PoeDetector.ClassifyProcess("PathOfExileSteam", "Path of Exile");
        Assert.IsTrue(isPoe1Steam);
        Assert.AreEqual("poe1", game1Steam);

        // PoE 2 Standalone & Steam
        var (isPoe2, game2) = PoeDetector.ClassifyProcess("PathOfExile2", "Path of Exile 2");
        Assert.IsTrue(isPoe2);
        Assert.AreEqual("poe2", game2);

        var (isPoe2Steam, game2Steam) = PoeDetector.ClassifyProcess("PathOfExile2Steam", "Path of Exile 2");
        Assert.IsTrue(isPoe2Steam);
        Assert.AreEqual("poe2", game2Steam);

        // Fallback by window title
        var (isPoeTitle, gameTitle) = PoeDetector.ClassifyProcess("UnknownWrapper", "Path of Exile 2 - Early Access");
        Assert.IsTrue(isPoeTitle);
        Assert.AreEqual("poe2", gameTitle);

        // Non-PoE processes
        var (isNotPoe, _) = PoeDetector.ClassifyProcess("chrome", "Google Chrome");
        Assert.IsFalse(isNotPoe);

        var (isNotepad, _) = PoeDetector.ClassifyProcess("notepad", "Untitled - Notepad");
        Assert.IsFalse(isNotepad);
    }

    [TestMethod]
    public void TestPoeClipboardItemValidation()
    {
        // Valid PoE item text
        var validPoEItem = @"Item Class: Belts
Rarity: Unique
Mageblood
Heavy Belt
--------
Requirements:
Level: 44
--------
Item Level: 86
--------
+35 to Strength
--------
Magic Utility Flask Effects cannot be removed";

        Assert.IsTrue(ClipboardService.IsPoeItemText(validPoEItem));

        // Valid PoE 2 item text
        var validPoe2Item = @"Item Class: Boots
Rarity: Rare
Doom Stride
Advanced Slink Boots
--------
Quality: +20%
--------
Item Level: 78";

        Assert.IsTrue(ClipboardService.IsPoeItemText(validPoe2Item));

        // Invalid non-PoE text
        Assert.IsFalse(ClipboardService.IsPoeItemText(null));
        Assert.IsFalse(ClipboardService.IsPoeItemText(""));
        Assert.IsFalse(ClipboardService.IsPoeItemText("Just some random text copied by user"));
        Assert.IsFalse(ClipboardService.IsPoeItemText("http://localhost:3000"));
    }
}
