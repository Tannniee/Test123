namespace Poestash.Desktop;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();

        using var controller = new AppController();
        var initialized = controller.InitializeAsync().GetAwaiter().GetResult();

        if (initialized)
        {
            var dashboard = controller.CreateDashboardForm();
            Application.Run(dashboard);
        }
    }
}
