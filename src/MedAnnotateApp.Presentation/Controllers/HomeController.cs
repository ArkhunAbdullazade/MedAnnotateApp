using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MedAnnotateApp.Presentation.Models;
using Microsoft.AspNetCore.Authorization;
using MedAnnotateApp.Core.Repositories;
using Microsoft.AspNetCore.Identity;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Infrastructure.Data;
using MedAnnotateApp.Core.Services;

namespace MedAnnotateApp.Presentation.Controllers;

[Authorize]
public class HomeController : Controller
{
    private readonly IMedDataRepository medDataRepository;
    private readonly UserManager<User> userManager;
    private readonly MedDataDbContext context;

    public HomeController(IMedDataRepository medDataRepository, UserManager<User> userManager, MedDataDbContext context)
    {
        this.medDataRepository = medDataRepository;
        this.userManager = userManager;
        this.context = context;
    }

    public async Task<IActionResult> Index()
    {
        var user = await userManager.GetUserAsync(User);

        var (medData, counter) = await medDataRepository.GetNthMedDataBySpecialityAndPositionAsync(user?.Speciality!, user?.Position!, user?.BodyRegion!, user?.ImageModality!, user?.Id!);

        ViewBag.Counter = counter;  

        if (medData != null) ViewBag.MedDataKeywords = (await medDataRepository.GetKeywordsByMedDataIdAsync(medData.Id)).ToList();
        else ViewBag.MedDataKeywords = null;

        return View(medData);
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
