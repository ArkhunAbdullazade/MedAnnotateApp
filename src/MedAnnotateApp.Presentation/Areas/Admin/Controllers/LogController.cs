using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Services.Admin;
using MedAnnotateApp.Presentation.Areas.Admin.Models;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Areas.Admin.Controllers;

public class LogController(AdminQueryService queries) : AdminController
{
    public async Task<IActionResult> Index(int page = 1, CancellationToken cancellationToken = default) =>
        View(await queries.GetActionsAsync(page, cancellationToken));
}
