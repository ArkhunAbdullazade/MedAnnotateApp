using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Data;
using MedAnnotateApp.Presentation.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Controllers;

[AllowAnonymous]
public class IdentityController : Controller
{
    private readonly IMedDataRepository medDataRepository;
    private readonly IIdentityService identityService;
    private readonly UserManager<User> userManager;

    public IdentityController(IMedDataRepository medDataRepository, IIdentityService identityService, UserManager<User> userManager)
    {
        this.medDataRepository = medDataRepository;
        this.identityService = identityService;
        this.userManager = userManager;
    }

    [HttpGet]
    public IActionResult Signup() 
    {
        if (User.Identity!.IsAuthenticated)
        {
            return RedirectToAction("Index", "Home");
        }

        ViewBag.Specialities = new[] {
            "pulmonology", "oncology", "dermatology", "pathology",
            "general surgery",  "oral and maxillofacial surgery",
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
        
        return base.View();
    }

    [HttpPost]
    public async Task<IActionResult> Signup([FromForm] SignupDto signupDto)
    {
        if (!ModelState.IsValid)
        {
            return View(signupDto);
        }

        var newUser = new User()
        {
            Email = signupDto.Email,
            FullName = signupDto.FullName,
            UserName = signupDto.Email,
            University = signupDto.University,
            Position = signupDto.Position,
            Speciality = signupDto.Speciality,
            ClinicalExperience = signupDto.ClinicalExperience,
        };

        var confirmationUrl = Url.Action(nameof(ConfirmEmail), "Identity", null, Request.Scheme);

        var (succeeded, errors) = await identityService.SignupAsync(newUser, signupDto.Password!, confirmationUrl!);
        
        // if (succeeded) return RedirectToAction("EmailConfirmation");
        if (succeeded) return base.RedirectToAction("Login");
        
        foreach (var error in errors ?? Enumerable.Empty<string>())
        {
            ModelState.AddModelError("", error);
        }
        
        return View(signupDto);
    }

    [HttpGet]
    public IActionResult Login() {
        if (User.Identity!.IsAuthenticated)
        {
            return RedirectToAction("Index", "Home");
        }

        return base.View();
    }

    [HttpPost]
    public async Task<IActionResult> Login([FromForm] LoginDto loginDto)
    {
        if (!ModelState.IsValid)
        {
            return View(loginDto);
        }

        // var user = await userManager.FindByEmailAsync(loginDto.Email!);

        // if (user is not null && !user.EmailConfirmed)
        // {
        //     ModelState.AddModelError("", "You need to confirm your email to log in.");
        //     return View(loginDto);
        // }

        var (succeeded, errors) = await this.identityService.LoginAsync(loginDto.Email!, loginDto.Password!);

        if (succeeded)  return base.RedirectToAction(controllerName: "Home", actionName: "Index");

        foreach (var error in errors ?? Enumerable.Empty<string>())
        {
            ModelState.AddModelError("", error);
        }

        return View(loginDto);
    }

    [HttpGet]
    public IActionResult EmailConfirmation() => base.View();

    [HttpGet]
    public async Task<IActionResult> ConfirmEmail(string userId, string token)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(token))
            return BadRequest();
        
        var result = await identityService.ConfirmEmailAsync(userId, token);

        if (!result)
        {
            return RedirectToAction("Signup");
        }

        return base.RedirectToAction("Login");
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Logout(int MedDataId)
    {
        await this.identityService.SignoutAsync();

        await medDataRepository.UpdateIsAnnotated(MedDataId);
        
        // await counterRepository.UpdateCurrentCounterByUserIdAsync(user?.Id!, user?.Speciality!);

        return Json(new { success = true });
    }
}