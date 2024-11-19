using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Services;
using MedAnnotateApp.Presentation.ActionFilters;
using MedAnnotateApp.Presentation.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Controllers;

[ServiceFilter(typeof(AuthorizationAccessFilter))]
public class IdentityController : Controller
{
    private readonly IMedDataRepository medDataRepository;
    private readonly IIdentityService identityService;
    private readonly UserManager<User> userManager;
    private readonly IConfiguration configuration;

    public IdentityController(IMedDataRepository medDataRepository, IIdentityService identityService, UserManager<User> userManager, IConfiguration configuration)
    {
        this.medDataRepository = medDataRepository;
        this.identityService = identityService;
        this.userManager = userManager;
        this.configuration = configuration;
    }

    [HttpGet]
    public IActionResult Signup()
    {
        if (User.Identity!.IsAuthenticated)
        {
            return RedirectToAction("Index", "Home");
        }

        // Populate ModelState with errors from TempData
        if (TempData["Errors"] is List<string> errors)
        {
            foreach (var error in errors)
            {
                ModelState.AddModelError("", error);
            }
        }

        // Restore form data if available
        if (TempData["FormData"] is SignupDto formData)
        {
            return View(formData);
        }

        ViewBag.Specialities = new[]
        {
            "pulmonology", "oncology", "dermatology", "pathology",
            "general surgery", "oral and maxillofacial surgery",
            "pediatrics", "ophthalmology", "cardiology", "neurosurgery",
            "cardiac surgery", "neurology", "infectious diseases", "radiology",
            "orthopedics", "obstetrics and gynecology", "urology",
            "thoracic surgery", "plastic surgery", "endocrinology",
            "toxicology", "microbiology", "vascular surgery",
            "gastroenterology", "internal medicine", "dentistry", "genetics",
            "rheumatology", "otorhinolaryngology", "anatomy", "critical care",
            "nephrology", "hematology", "anesthesiology",
            "pediatric cardiology", "forensic medicine",
            "rehabilitation medicine", "proctology", "psychiatry",
            "sports medicine", "immunology", "parasitology", "allergy",
            "radiotherapy", "neonatology", "emergency medicine",
            "traditional medicine", "physiology", "hepatology", "podiatry"
        };

        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Signup([FromForm] SignupDto signupDto)
    {
        if (!ModelState.IsValid)
        {
            TempData["Errors"] = ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage)).ToList();
            TempData["FormData"] = signupDto;
            return RedirectToAction("Signup");
        }

        var newUser = new User
        {
            Email = signupDto.Email,
            FullName = signupDto.FullName,
            UserName = signupDto.Email,
            University = signupDto.University,
            Position = signupDto.Position,
            Speciality = signupDto.Speciality,
            ClinicalExperience = signupDto.ClinicalExperience,
            OrcidId = signupDto.OrcidId,
        };

        // var confirmationUrl = Url.Action(nameof(ConfirmEmail), "Identity", null, Request.Scheme);
        // var (succeeded, errors) = await identityService.SignupAsync(newUser, signupDto.Password!, confirmationUrl!);

        var (succeeded, errors) = await identityService.SignupAsync(newUser, signupDto.Password!, null);

        if (succeeded)
        {
            return RedirectToAction("Login");
        }

        TempData["Errors"] = errors?.ToList() ?? new List<string>();
        TempData["FormData"] = signupDto;

        return RedirectToAction("Signup");
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult AuthorizationAccess()
    {
        if (User.Identity!.IsAuthenticated)
        {
            return RedirectToAction("Index", "Home");
        }

        // Populate ModelState with errors from TempData
        if (TempData["Errors"] is List<string> errors)
        {
            foreach (var error in errors)
            {
                ModelState.AddModelError("", error);
            }
        }

        return View();
    }

    [HttpPost]
    [AllowAnonymous]
    public IActionResult AuthorizationAccess([FromForm] AuthorizationAccessDto authorizationAccessDto)
    {
        if (!ModelState.IsValid)
        {
            TempData["Errors"] = ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage)).ToList();
            return RedirectToAction("AuthorizationAccess");
        }

        var hashedPassword = configuration["AuthorizationAccessPasswordHash"];

        if (AuthorizationAccessPasswordService.VerifyPassword(authorizationAccessDto.Password!, hashedPassword!))
        {
            HttpContext.Session.SetString("Authorized", "true");
            return RedirectToAction("Login");
        }

        TempData["Errors"] = new List<string> { "Incorrect password." };
        return RedirectToAction("AuthorizationAccess");
    }

    [HttpGet]
    public IActionResult Login()
    {
        if (User.Identity!.IsAuthenticated)
        {
            return RedirectToAction("Index", "Home");
        }

        // Populate ModelState with errors from TempData
        if (TempData["Errors"] is List<string> errors)
        {
            foreach (var error in errors)
            {
                ModelState.AddModelError("", error);
            }
        }

        // Restore form data if available
        if (TempData["FormData"] is LoginDto formData)
        {
            return View(formData);
        }

        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Login([FromForm] LoginDto loginDto)
    {
        if (!ModelState.IsValid)
        {
            TempData["Errors"] = ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage)).ToList();
            TempData["FormData"] = loginDto;
            return RedirectToAction("Login");
        }

        var (succeeded, errors) = await this.identityService.LoginAsync(loginDto.Email!, loginDto.Password!);

        if (succeeded)
        {
            return RedirectToAction("Index", "Home");
        }

        TempData["Errors"] = errors?.ToList() ?? new List<string>();
        TempData["FormData"] = loginDto;

        return RedirectToAction("Login");
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] LogoutDto logoutDto)
    {
        await this.identityService.SignoutAsync();
        HttpContext.Session.Clear();

        if (logoutDto.MedDataId != null && logoutDto.IsAnnotationStarted == false)
        {
            await medDataRepository.UpdateLock(logoutDto.MedDataId.Value);
        }

        if (logoutDto.MedDataId != null && logoutDto.IsAnnotationFinished == true)
        {
            await medDataRepository.UpdateIsAnnotated(logoutDto.MedDataId.Value);
        }

        return Json(new { success = true });
    }
}
