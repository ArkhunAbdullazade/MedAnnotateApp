using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Services.Admin;
using MedAnnotateApp.Presentation.Areas.Admin.Models;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Areas.Admin.Controllers;

public class ExportController(AdminQueryService queries, ResultsExportService export) : AdminController
{
    public async Task<IActionResult> Index(CancellationToken cancellationToken) =>
        View(await queries.GetOverviewAsync(cancellationToken: cancellationToken));

    public async Task<IActionResult> Download([FromQuery] ExportOptions options, CancellationToken cancellationToken)
    {
        try
        {
            var stream = await export.CreateArchiveAsync(options, cancellationToken);
            return File(stream, "application/zip", $"medannotate-results-{DateTime.UtcNow:yyyyMMdd-HHmm}.zip");
        }
        catch (ExportBusyException exception)
        {
            Flash(exception.Message, false);
            return RedirectToAction(nameof(Index));
        }
    }
}
