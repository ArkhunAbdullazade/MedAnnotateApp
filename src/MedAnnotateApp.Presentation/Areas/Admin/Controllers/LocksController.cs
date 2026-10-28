using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Services.Admin;
using MedAnnotateApp.Presentation.Areas.Admin.Models;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Areas.Admin.Controllers;

public class LocksController(AdminQueryService queries, AssignmentAdminService assignments) : AdminController
{
    public async Task<IActionResult> Index(CancellationToken cancellationToken) =>
        View(new LocksViewModel(await queries.GetLocksAsync(cancellationToken), queries.StaleAfter));

    [HttpPost]
    public async Task<IActionResult> Release(string[] selected)
    {
        var locks = selected.Select(LocksViewModel.ParseKey).OfType<(int, bool, string)>().ToList();
        if (locks.Count == 0)
        {
            Flash("Select at least one lock to release.", false);
            return RedirectToAction(nameof(Index));
        }
        var results = await assignments.ReleaseManyAsync(locks, AdminId);
        queries.InvalidateOverview();
        var released = results.Count(result => result.Released);
        var kept = results.Sum(result => result.KeptResponses);
        Flash(results.Count == 1 ? results[0].Message
            : $"Released {released} of {results.Count} lock(s)." + (kept > 0 ? $" {kept} saved answer(s) were kept as incomplete sets." : ""),
            released == results.Count);
        return RedirectToAction(nameof(Index));
    }
}
