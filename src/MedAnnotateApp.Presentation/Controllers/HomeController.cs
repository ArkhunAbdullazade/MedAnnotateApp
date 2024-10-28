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
    // private readonly ICounterRepository counterRepository;
    private readonly UserManager<User> userManager;
    private readonly MedDataDbContext context;

    public HomeController(IMedDataRepository medDataRepository, UserManager<User> userManager, MedDataDbContext context)
    {
        this.medDataRepository = medDataRepository;
        // this.counterRepository = counterRepository;
        this.userManager = userManager;
        this.context = context;
    }

    public async Task<IActionResult> Index()
    {
        var user = await userManager.GetUserAsync(User);

        // var currentCounter = await counterRepository.GetCurrentCounterAsync(user?.Id!, user?.Speciality!);

        var medData = await medDataRepository.GetNthMedDataBySpecialityAndPositionAsync(user?.Speciality!, user?.Position!, user?.Id!);

        // await counterRepository.UpdateMaxCounterBySpecialityAsync(user?.Id!, user?.Speciality!);

        ViewBag.MedDataKeywords = (await medDataRepository.GetKeywordsByMedDataIdAsync(medData!.Id)).ToList();

        return View(medData);
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
