using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Poestash.Desktop.Server;

public class HealthResponse
{
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("service")]
    public string? Service { get; set; }

    [JsonPropertyName("version")]
    public string? Version { get; set; }

    [JsonPropertyName("pid")]
    public int? Pid { get; set; }

    [JsonPropertyName("uptime")]
    public double? Uptime { get; set; }

    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }
}

public class HealthCheckResult
{
    public bool IsReachable { get; init; }
    public bool IsPoestashService { get; init; }
    public int Port { get; init; }
    public string Host { get; init; } = "127.0.0.1";
    public HealthResponse? Data { get; init; }
    public string? ErrorMessage { get; init; }

    public static HealthCheckResult Success(string host, int port, HealthResponse data) =>
        new()
        {
            IsReachable = true,
            IsPoestashService = data.Service == "poestash-server" && data.Status == "ok",
            Port = port,
            Host = host,
            Data = data
        };

    public static HealthCheckResult Unreachable(string host, int port, string? error = null) =>
        new()
        {
            IsReachable = false,
            IsPoestashService = false,
            Port = port,
            Host = host,
            ErrorMessage = error
        };

    public static HealthCheckResult OtherService(string host, int port) =>
        new()
        {
            IsReachable = true,
            IsPoestashService = false,
            Port = port,
            Host = host,
            ErrorMessage = "Port is occupied by another non-POESTASH service."
        };
}

public class HealthClient : IDisposable
{
    private readonly HttpClient _httpClient;

    public HealthClient(TimeSpan? timeout = null)
    {
        _httpClient = new HttpClient
        {
            Timeout = timeout ?? TimeSpan.FromMilliseconds(1500)
        };
    }

    public async Task<HealthCheckResult> CheckHealthAsync(string host, int port, CancellationToken ct = default)
    {
        var url = $"http://{host}:{port}/api/health";
        try
        {
            using var response = await _httpClient.GetAsync(url, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return HealthCheckResult.Unreachable(host, port, $"HTTP {(int)response.StatusCode}");
            }

            var data = await response.Content.ReadFromJsonAsync<HealthResponse>(cancellationToken: ct).ConfigureAwait(false);
            if (data != null && data.Service == "poestash-server")
            {
                return HealthCheckResult.Success(host, port, data);
            }

            return HealthCheckResult.OtherService(host, port);
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unreachable(host, port, ex.Message);
        }
    }

    public void Dispose()
    {
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }
}
