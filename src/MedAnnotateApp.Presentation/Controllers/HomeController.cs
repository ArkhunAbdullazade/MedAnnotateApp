using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MedAnnotateApp.Presentation.Models;
using Microsoft.AspNetCore.Authorization;
using MedAnnotateApp.Core.Repositories;
using Microsoft.AspNetCore.Identity;
using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Presentation.Controllers;

[Authorize]
public class HomeController : Controller
{
    private readonly IMedDataRepository medDataRepository;
    private readonly UserManager<User> userManager;

    public HomeController(IMedDataRepository medDataRepository, UserManager<User> userManager)
    {
        this.medDataRepository = medDataRepository;
        this.userManager = userManager;
    }

    public async Task<IActionResult> Index(int n = 1)
    {
        var user = await userManager.GetUserAsync(User);

        var medData = await medDataRepository.GetNthMedDataBySpecialityAsync(user?.Speciality!, n);

        ViewBag.MedDataKeywords = await medDataRepository.GetKeywordsByMedDataIdAsync(medData!.Id);
        
        return View(medData);
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
