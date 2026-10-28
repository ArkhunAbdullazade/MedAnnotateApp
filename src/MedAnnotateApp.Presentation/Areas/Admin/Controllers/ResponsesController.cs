using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Services.Admin;
using MedAnnotateApp.Presentation.Areas.Admin.Models;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Areas.Admin.Controllers;

public class ResponsesController(AdminQueryService queries, ResultsExportService export) : AdminController
{
    public async Task<IActionResult> Index([FromQuery] ResponseQuery query, CancellationToken cancellationToken) =>
        View(new ResponsesViewModel(await queries.GetResponsesAsync(query, cancellationToken), query,
            await queries.GetCategoryOptionsAsync(cancellationToken), await queries.GetPeopleAsync(cancellationToken)));

    public async Task<IActionResult> Download([FromQuery] ResponseQuery query, IdentityMode identity, CancellationToken cancellationToken)
    {
        try
        {
            var stream = await export.CreateResponsesCsvAsync(query, identity, cancellationToken);
            return File(stream, "text/csv; charset=utf-8", $"medannotate-{(query.IsStudent ? "student" : "specialist")}-filtered-{DateTime.UtcNow:yyyyMMdd-HHmm}.csv");
        }
        catch (ExportBusyException exception)
        {
            Flash(exception.Message, false);
            return RedirectToAction(nameof(Index), query);
        }
    }
}
