using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Poestash.Desktop.Bridge;

public class InspectPayload
{
    [JsonPropertyName("requestId")]
    public string RequestId { get; set; } = Guid.NewGuid().ToString("N");

    [JsonPropertyName("game")]
    public string Game { get; set; } = "poe1";

    [JsonPropertyName("source")]
    public string Source { get; set; } = "clipboard";

    [JsonPropertyName("rawText")]
    public string RawText { get; set; } = string.Empty;

    [JsonPropertyName("capturedAt")]
    public string CapturedAt { get; set; } = DateTime.UtcNow.ToString("o");
}

public class BridgeInspectResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("requestId")]
    public string? RequestId { get; set; }

    [JsonPropertyName("clientsNotified")]
    public int ClientsNotified { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

public class BridgeStatusResponse
{
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("activeClients")]
    public int ActiveClients { get; set; }

    [JsonPropertyName("hasLatest")]
    public bool HasLatest { get; set; }

    [JsonPropertyName("lastCapturedAt")]
    public string? LastCapturedAt { get; set; }
}

public class BridgeClient : IDisposable
{
    private readonly HttpClient _httpClient;

    public BridgeClient(TimeSpan? timeout = null)
    {
        _httpClient = new HttpClient
        {
            Timeout = timeout ?? TimeSpan.FromMilliseconds(2000)
        };
    }

    public async Task<BridgeInspectResponse> SendInspectAsync(
        string host,
        int port,
        string rawText,
        string game = "poe1",
        CancellationToken ct = default)
    {
        var url = $"http://{host}:{port}/api/bridge/inspect";
        var payload = new InspectPayload
        {
            Game = game,
            RawText = rawText
        };

        try
        {
            using var response = await _httpClient.PostAsJsonAsync(url, payload, ct).ConfigureAwait(false);
            var result = await response.Content.ReadFromJsonAsync<BridgeInspectResponse>(cancellationToken: ct).ConfigureAwait(false);
            return result ?? new BridgeInspectResponse { Success = false, Error = "Empty response from bridge" };
        }
        catch (Exception ex)
        {
            return new BridgeInspectResponse
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public async Task<BridgeStatusResponse?> GetStatusAsync(string host, int port, CancellationToken ct = default)
    {
        var url = $"http://{host}:{port}/api/bridge/status";
        try
        {
            return await _httpClient.GetFromJsonAsync<BridgeStatusResponse>(url, ct).ConfigureAwait(false);
        }
        catch
        {
            return null;
        }
    }

    public void Dispose()
    {
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }
}
