using System.Net;
using System.Net.Sockets;

namespace Poestash.Desktop.Server;

public enum PortResolutionMode
{
    AvailableForNewServer,
    ReuseExistingServer,
    AllPortsExhausted
}

public class PortResolutionResult
{
    public PortResolutionMode Mode { get; init; }
    public int Port { get; init; }
    public string Host { get; init; } = "127.0.0.1";
    public HealthCheckResult? ExistingServerHealth { get; init; }
    public string? ErrorMessage { get; init; }

    public static PortResolutionResult Available(string host, int port) =>
        new()
        {
            Mode = PortResolutionMode.AvailableForNewServer,
            Host = host,
            Port = port
        };

    public static PortResolutionResult Reuse(string host, int port, HealthCheckResult health) =>
        new()
        {
            Mode = PortResolutionMode.ReuseExistingServer,
            Host = host,
            Port = port,
            ExistingServerHealth = health
        };

    public static PortResolutionResult Exhausted(string host, int startPort, int endPort) =>
        new()
        {
            Mode = PortResolutionMode.AllPortsExhausted,
            Host = host,
            Port = startPort,
            ErrorMessage = $"All ports in range {startPort}..{endPort} are occupied by other applications."
        };
}

public class PortResolver
{
    public async Task<PortResolutionResult> ResolvePortAsync(
        string host,
        int startPort,
        int scanRange,
        HealthClient healthClient,
        CancellationToken ct = default)
    {
        var endPort = startPort + Math.Max(0, scanRange);

        for (var port = startPort; port <= endPort; port++)
        {
            ct.ThrowIfCancellationRequested();

            if (IsPortAvailable(host, port))
            {
                return PortResolutionResult.Available(host, port);
            }

            // Port is occupied. Probe /api/health to see if it's POESTASH
            var health = await healthClient.CheckHealthAsync(host, port, ct).ConfigureAwait(false);
            if (health.IsReachable && health.IsPoestashService)
            {
                return PortResolutionResult.Reuse(host, port, health);
            }
        }

        return PortResolutionResult.Exhausted(host, startPort, endPort);
    }

    public static bool IsPortAvailable(string host, int port)
    {
        try
        {
            var ip = IPAddress.Parse(host);
            var listener = new TcpListener(ip, port);
            listener.Start();
            listener.Stop();
            return true;
        }
        catch (SocketException)
        {
            return false;
        }
    }
}
