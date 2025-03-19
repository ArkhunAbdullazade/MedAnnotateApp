using System.Text.Json;
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
        ViewBag.Specialities = new[]
        {
            "allergy", "anatomy", "anesthesiology", "cardiology", "critical care", 
            "dentistry", "dermatology", "emergency medicine", "endocrinology", "forensic medicine", 
            "gastroenterology", "general surgery", "genetics", "hematology", "hepatology", 
            "immunology", "infectious diseases", "internal medicine", "microbiology", "neonatology", 
            "nephrology", "neurology", "neurosurgery", "obstetrics and gynecology", "oncology", 
            "ophthalmology", "oral and maxillofacial surgery", "orthopedics", "otorhinolaryngology", "parasitology", 
            "pathology", "pediatric cardiology", "pediatrics", "physiology", "plastic surgery", 
            "podiatry", "proctology", "psychiatry", "radiology", "radiotherapy", 
            "rehabilitation medicine", "rheumatology", "sports medicine", "thoracic surgery", "toxicology", 
            "traditional medicine", "urology", "vascular surgery","cardiac surgery","pulmonology"
        };

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

        if (TempData["FormData"] is string formDataJson)
        {
            var formData = JsonSerializer.Deserialize<SignupDto>(formDataJson);
            return View(formData);
        }

        return View();
    }

    [HttpPost]
    public async Task<IActionResult> PostSignup([FromForm] SignupDto signupDto)
    {
        if (!ModelState.IsValid)
        {
            TempData["Errors"] = ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage)).ToList();
            TempData["FormData"] = JsonSerializer.Serialize(signupDto);
            return RedirectToAction(nameof(Signup));
        }

        var newUser = new User
        {
            Email = signupDto.Email,
            FullName = signupDto.FullName,
            UserName = signupDto.Email,
            University = signupDto.University,
            Position = signupDto.Position,
            Speciality = signupDto.Speciality,
            BodyRegion = signupDto.BodyRegion != null ? string.Join(",", signupDto.BodyRegion) : null,
            ImageModality = signupDto.ImageModality != null ? string.Join(",", signupDto.ImageModality) : null,
            ClinicalExperience = signupDto.ClinicalExperience,
            OrcidId = signupDto.OrcidId,
        };

        var (succeeded, errors) = await identityService.SignupAsync(newUser, signupDto.Password!, null!);

        if (succeeded)
        {
            return RedirectToAction(nameof(Login));
        }

        // Add errors to TempData and redirect to GET Signup
        TempData["Errors"] = TempData["Errors"] = new List<string> { "This Email is Already in Use" };
        TempData["FormData"] = JsonSerializer.Serialize(signupDto);

        return RedirectToAction(nameof(Signup));
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

        if (TempData["FormData"] is string formDataJson)
        {
            var formData = JsonSerializer.Deserialize<AuthorizationAccessDto>(formDataJson);
            return View(formData);
        }

        return View();
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public IActionResult PostAuthorizationAccess([FromForm] AuthorizationAccessDto authorizationAccessDto)
    {
        if (!ModelState.IsValid)
        {
            TempData["Errors"] = ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage)).ToList();
            return RedirectToAction(nameof(AuthorizationAccess));
        }

        var hashedPassword = configuration["AuthorizationAccessPasswordHash"];
        if (AuthorizationAccessPasswordService.VerifyPassword(authorizationAccessDto.Password!, hashedPassword!))
        {
            HttpContext.Session.SetString("Authorized", "true");
            return RedirectToAction(nameof(Login));
        }

        TempData["Errors"] = new List<string> { "Incorrect password." };
        return RedirectToAction(nameof(AuthorizationAccess));
    }

    [HttpGet]
    public IActionResult Login()
    {
        if (User.Identity!.IsAuthenticated)
        {
            return RedirectToAction("Index", "Home");
        }

        if (TempData["Errors"] is List<string> errors)
        {
            foreach (var error in errors)
            {
                ModelState.AddModelError("", error);
            }
        }

        if (TempData["FormData"] is string formDataJson)
        {
            var formData = JsonSerializer.Deserialize<LoginDto>(formDataJson);
            return View(formData);
        }

        return View();
    }

    [HttpPost]
    public async Task<IActionResult> PostLogin([FromForm] LoginDto loginDto)
    {
        if (!ModelState.IsValid)
        {
            TempData["Errors"] = ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage)).ToList();
            TempData["FormData"] = JsonSerializer.Serialize(loginDto);
            return RedirectToAction(nameof(Login));
        }

        var (succeeded, errors) = await this.identityService.LoginAsync(loginDto.Email!, loginDto.Password!);

        if (succeeded)
        {
            return RedirectToAction("Index", "Home");
        }

        TempData["Errors"] = new List<string> { "Incorrect Email or Password." };
        TempData["FormData"] = JsonSerializer.Serialize(loginDto);

        return RedirectToAction(nameof(Login));
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] LogoutDto logoutDto)
    {
        await this.identityService.SignoutAsync();
        HttpContext.Session.Clear();

        if (logoutDto.MedDataId != null)
        {
            await medDataRepository.UpdateLock(logoutDto.MedDataId.Value, logoutDto.KeywordStates!, logoutDto.IsAnnotationStarted);
        }
    
        return Json(new { success = true });
    }
}
