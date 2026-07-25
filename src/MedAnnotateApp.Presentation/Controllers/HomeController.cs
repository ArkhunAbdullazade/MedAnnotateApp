using System.Diagnostics;
using System.Security.Claims;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Presentation.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Controllers;

public class HomeController : Controller
{
    private readonly IMedDataRepository medDataRepository;
    private readonly UserManager<User> userManager;
    private readonly ILogger<HomeController> logger;

    public HomeController(
        IMedDataRepository medDataRepository,
        UserManager<User> userManager,
        ILogger<HomeController> logger)
    {
        this.medDataRepository = medDataRepository;
        this.userManager = userManager;
        this.logger = logger;
    }

    [AllowAnonymous]
    public IActionResult Index()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            if (User.IsInRole("Medical_Student"))
            {
                return RedirectToAction(nameof(Student));
            }

            if (User.IsInRole("Professional"))
            {
                return RedirectToAction(nameof(Professional));
            }

            logger.LogWarning("User is authenticated but has no role.");
            return View("Error", new ErrorViewModel
            {
                RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier,
                ErrorMessage = "Authentication error: no valid role assigned to your account"
            });
        }

        return HttpContext.Session.Keys.Contains("Authorized")
            ? RedirectToAction("Login", "Identity")
            : RedirectToAction("AuthorizationAccess", "Identity");
    }

    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> Professional()
    {
        try
        {
            logger.LogDebug(
                "Professional action. Authenticated: {Authenticated}, User: {User}, Roles: {Roles}",
                User.Identity?.IsAuthenticated,
                User.Identity?.Name,
                string.Join(", ", User.Claims.Where(claim => claim.Type == ClaimTypes.Role).Select(claim => claim.Value)));

            var user = await userManager.GetUserAsync(User);
            if (user == null)
            {
                logger.LogWarning("User is null in Professional action despite authenticated request.");
                return RedirectToAction("Login", "Identity");
            }

            var (medData, counter) = await medDataRepository.GetNthMedDataBySpecialityAndPositionAsync(
                user.Speciality,
                user.Position,
                user.BodyRegion,
                user.ImageModality,
                user.Id);

            ViewBag.Counter = counter;
            ViewBag.MedDataKeywords = medData != null
                ? (await medDataRepository.GetKeywordsByMedDataIdAsync(medData.Id)).ToList()
                : null;

            return View(medData);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in Professional action.");
            return RedirectToAction(nameof(Error));
        }
    }

    [Authorize(Roles = "Medical_Student")]
    public async Task<IActionResult> Student()
    {
        try
        {
            var user = await userManager.GetUserAsync(User);
            if (user == null)
            {
                logger.LogWarning("User is null in Student action despite authenticated request.");
                return RedirectToAction("Login", "Identity");
            }

            var (medData, counter) = await medDataRepository.GetNthMedDataBySpecialityAndPositionAsync(
                user.Speciality,
                user.Position,
                user.BodyRegion,
                user.ImageModality,
                user.Id);

            ViewBag.Counter = counter;
            ViewBag.MedDataKeywords = medData != null
                ? (await medDataRepository.GetKeywordsByMedDataIdAsync(medData.Id)).ToList()
                : null;

            return View(medData);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in Student action.");
            return RedirectToAction(nameof(Error));
        }
    }

    [AllowAnonymous]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
