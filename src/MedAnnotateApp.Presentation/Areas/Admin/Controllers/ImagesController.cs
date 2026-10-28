using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Services.Admin;
using MedAnnotateApp.Presentation.Areas.Admin.Models;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Areas.Admin.Controllers;

public class ImagesController(AdminQueryService queries, AssignmentAdminService assignments) : AdminController
{
    public async Task<IActionResult> Index([FromQuery] ImageQuery query, CancellationToken cancellationToken) =>
        View(new ImagesViewModel(await queries.GetImagesAsync(query, cancellationToken), query, await queries.GetCategoryOptionsAsync(cancellationToken)));

    public async Task<IActionResult> Details(int id, CancellationToken cancellationToken)
    {
        var detail = await queries.GetImageAsync(id, cancellationToken);
        return detail == null ? NotFound() : View(detail);
    }

    [HttpPost]
    public async Task<IActionResult> Release(int id, bool student, string holderId, string? returnUrl)
    {
        var result = await assignments.ReleaseAsync(id, student, holderId, AdminId);
        queries.InvalidateOverview();
        Flash(result.Message, result.Released);
        return BackTo(returnUrl, nameof(Details), new { id });
    }
}
