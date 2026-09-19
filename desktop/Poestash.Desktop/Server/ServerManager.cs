using System.Diagnostics;

namespace Poestash.Desktop.Server;

public class ServerManager : IDisposable
{
    private Process? _nodeProcess;
    private int? _reusedPid;
    private readonly HealthClient _healthClient;
    private bool _isDisposed;

    public bool IsProcessManagedByHost => (_nodeProcess != null && !_nodeProcess.HasExited) || IsReusedProcessActive();
    public int? ProcessId => _nodeProcess?.Id ?? (_reusedPid.HasValue && IsReusedProcessActive() ? _reusedPid : null);
    public int BoundPort { get; private set; }
    public string BoundHost { get; private set; } = "127.0.0.1";
    public string ServerUrl => $"http://{BoundHost}:{BoundPort}";

    public void AdoptExistingProcess(int pid, string host, int port)
    {
        _reusedPid = pid;
        BoundHost = host;
        BoundPort = port;
    }

    private bool IsReusedProcessActive()
    {
        if (!_reusedPid.HasValue) return false;
        try
        {
            var p = Process.GetProcessById(_reusedPid.Value);
            return !p.HasExited;
        }
        catch
        {
            _reusedPid = null;
            return false;
        }
    }

    public ServerManager(HealthClient healthClient)
    {
        _healthClient = healthClient;
        AppDomain.CurrentDomain.ProcessExit += (_, _) => Dispose();
    }

    public static string FindNodeExecutable()
    {
        var appDir = AppDomain.CurrentDomain.BaseDirectory;
        var bundledNode = Path.Combine(appDir, "runtime", "node.exe");
        if (File.Exists(bundledNode))
        {
            return bundledNode;
        }

        // Search PATH
        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var path in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            try
            {
                var candidate = Path.Combine(path.Trim(), "node.exe");
                if (File.Exists(candidate)) return candidate;
            }
            catch {}
        }

        return "node";
    }

    public static string? FindServerScript()
    {
        var appDir = AppDomain.CurrentDomain.BaseDirectory;

        // Bundled layout: app/server.js
        var bundledScript = Path.Combine(appDir, "app", "server.js");
        if (File.Exists(bundledScript)) return bundledScript;

        // Dev layouts: searching up to repository root
        var dir = new DirectoryInfo(appDir);
        for (var i = 0; i < 8 && dir != null; i++)
        {
            var candidate = Path.Combine(dir.FullName, "server.js");
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }

        return null;
    }

    public async Task<bool> StartAsync(string host, int port, CancellationToken ct = default)
    {
        BoundHost = host;
        BoundPort = port;

        var nodePath = FindNodeExecutable();
        var serverScript = FindServerScript();

        if (serverScript == null || !File.Exists(serverScript))
        {
            throw new FileNotFoundException("Unable to locate server.js. Ensure POESTASH backend is built or present in app directory.");
        }

        var workingDir = Path.GetDirectoryName(serverScript) ?? AppDomain.CurrentDomain.BaseDirectory;

        var startInfo = new ProcessStartInfo
        {
            FileName = nodePath,
            Arguments = $"\"{serverScript}\" --port {port} --host {host}",
            WorkingDirectory = workingDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        _nodeProcess = new Process { StartInfo = startInfo };
        _nodeProcess.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrWhiteSpace(e.Data))
            {
                Debug.WriteLine($"[Node Stdout] {e.Data}");
            }
        };
        _nodeProcess.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrWhiteSpace(e.Data))
            {
                Debug.WriteLine($"[Node Stderr] {e.Data}");
            }
        };

        _nodeProcess.Start();
        _nodeProcess.BeginOutputReadLine();
        _nodeProcess.BeginErrorReadLine();

        // Wait up to 15 seconds for /api/health to respond
        var maxWait = TimeSpan.FromSeconds(15);
        var startTime = DateTime.UtcNow;

        while (DateTime.UtcNow - startTime < maxWait)
        {
            ct.ThrowIfCancellationRequested();

            if (_nodeProcess.HasExited)
            {
                throw new InvalidOperationException($"Node process terminated unexpectedly with exit code {_nodeProcess.ExitCode}.");
            }

            var health = await _healthClient.CheckHealthAsync(host, port, ct).ConfigureAwait(false);
            if (health.IsReachable && health.IsPoestashService)
            {
                return true;
            }

            await Task.Delay(250, ct).ConfigureAwait(false);
        }

        await StopAsync().ConfigureAwait(false);
        throw new TimeoutException($"Timed out waiting for POESTASH backend to respond on http://{host}:{port}/api/health.");
    }

    public async Task StopAsync()
    {
        if (_nodeProcess != null && !_nodeProcess.HasExited)
        {
            try
            {
                _nodeProcess.Kill(entireProcessTree: true);
                _nodeProcess.WaitForExit(3000);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ServerManager] Error terminating Node process: {ex.Message}");
            }
            finally
            {
                _nodeProcess.Dispose();
                _nodeProcess = null;
            }
        }

        if (_reusedPid.HasValue)
        {
            try
            {
                var p = Process.GetProcessById(_reusedPid.Value);
                if (!p.HasExited)
                {
                    p.Kill(entireProcessTree: true);
                    p.WaitForExit(3000);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ServerManager] Error terminating reused Node process: {ex.Message}");
            }
            finally
            {
                _reusedPid = null;
            }
        }

        // Final safety net: if BoundPort is set, probe /api/health to see if a poestash-server is still lingering
        if (BoundPort > 0)
        {
            try
            {
                var health = await _healthClient.CheckHealthAsync(BoundHost, BoundPort).ConfigureAwait(false);
                if (health.IsReachable && health.IsPoestashService && health.Data?.Pid.HasValue == true)
                {
                    var p = Process.GetProcessById(health.Data.Pid.Value);
                    if (!p.HasExited)
                    {
                        p.Kill(entireProcessTree: true);
                        p.WaitForExit(3000);
                    }
                }
            }
            catch {}
        }
    }

    public void Dispose()
    {
        if (!_isDisposed)
        {
            _isDisposed = true;
            try
            {
                StopAsync().GetAwaiter().GetResult();
            }
            catch {}
        }
        GC.SuppressFinalize(this);
    }
}
