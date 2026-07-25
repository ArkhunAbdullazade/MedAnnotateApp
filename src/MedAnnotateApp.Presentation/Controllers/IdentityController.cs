using System.Text.Json;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Services;
using MedAnnotateApp.Presentation.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Controllers;

public class IdentityController : Controller
{
    private static readonly string[] Specialities =
    [
        "allergy", "anatomy", "anesthesiology", "cardiology", "critical care",
        "dentistry", "dermatology", "emergency medicine", "endocrinology", "forensic medicine",
        "gastroenterology", "general surgery", "genetics", "hematology", "hepatology",
        "immunology", "infectious diseases", "internal medicine", "microbiology", "neonatology",
        "nephrology", "neurology", "neurosurgery", "obstetrics and gynecology", "oncology",
        "ophthalmology", "oral and maxillofacial surgery", "orthopedics", "otorhinolaryngology", "parasitology",
        "pathology", "pediatric cardiology", "pediatrics", "physiology", "plastic surgery",
        "podiatry", "proctology", "psychiatry", "radiology", "radiotherapy",
        "rehabilitation medicine", "rheumatology", "sports medicine", "thoracic surgery", "toxicology",
        "traditional medicine", "urology", "vascular surgery", "cardiac surgery", "pulmonology"
    ];

    private readonly IMedDataRepository medDataRepository;
    private readonly IIdentityService identityService;
    private readonly UserManager<User> userManager;
    private readonly IConfiguration configuration;
    private readonly ILogger<IdentityController> logger;

    public IdentityController(
        IMedDataRepository medDataRepository,
        IIdentityService identityService,
        UserManager<User> userManager,
        IConfiguration configuration,
        ILogger<IdentityController> logger)
    {
        this.medDataRepository = medDataRepository;
        this.identityService = identityService;
        this.userManager = userManager;
        this.configuration = configuration;
        this.logger = logger;
    }

    [AllowAnonymous]
    public IActionResult AuthorizationAccess()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToRoleBasedPage();
        }

        if (HttpContext.Session.Keys.Contains("Authorized"))
        {
            return RedirectToAction(nameof(Login));
        }

        ModelState.Clear();
        HandleTempDataErrors();

        return View();
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public IActionResult PostAuthorizationAccess(AuthorizationAccessDto authDto)
    {
        logger.LogInformation("Authorization access attempt");

        if (!ModelState.IsValid)
        {
            logger.LogWarning(
                "Authorization access validation failed: {Errors}",
                string.Join(", ", ModelState.Values.SelectMany(value => value.Errors).Select(error => error.ErrorMessage)));

            return View("AuthorizationAccess", authDto);
        }

        var hashedPassword = configuration["AuthorizationAccessPasswordHash"];
        if (AuthorizationAccessPasswordService.VerifyPassword(authDto.Password ?? string.Empty, hashedPassword))
        {
            logger.LogInformation("Authorization access granted");
            HttpContext.Session.SetString("Authorized", "true");
            return RedirectToAction(nameof(Login));
        }

        if (string.IsNullOrWhiteSpace(hashedPassword))
        {
            logger.LogError("AuthorizationAccessPasswordHash is not configured.");
        }
        else
        {
            logger.LogWarning("Authorization access denied.");
        }

        ModelState.AddModelError(string.Empty, "The password you entered is incorrect. Please try again.");
        return View("AuthorizationAccess", authDto);
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToRoleBasedPage();
        }

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            TempData["ReturnUrl"] = returnUrl;
        }

        ModelState.Clear();
        HandleTempDataErrors();

        return View();
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> PostLogin(LoginDto loginDto)
    {
        logger.LogInformation("Login attempt for email: {Email}", loginDto.Email);

        if (!ModelState.IsValid)
        {
            logger.LogWarning("Login form validation failed");
            return View("Login", loginDto);
        }

        var (succeeded, errors) = await identityService.LoginAsync(loginDto.Email, loginDto.Password);
        if (succeeded)
        {
            logger.LogInformation("User logged in successfully: {Email}", loginDto.Email);

            if (TempData["ReturnUrl"] is string returnUrl && Url.IsLocalUrl(returnUrl))
            {
                return Redirect(returnUrl);
            }

            return RedirectToRoleBasedPage();
        }

        logger.LogWarning(
            "Login failed for {Email}: {Errors}",
            loginDto.Email,
            errors != null && errors.Any() ? string.Join(", ", errors) : "No specific errors returned");

        foreach (var error in errors ?? ["Invalid email or password. Please try again."])
        {
            ModelState.AddModelError(string.Empty, error);
        }

        return View("Login", loginDto);
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] LogoutDto? logoutDto)
    {
        try
        {
            var isMedicalStudent = User.IsInRole("Medical_Student");

            await identityService.SignoutAsync();
            HttpContext.Session.Clear();

            if (logoutDto?.MedDataId is int medDataId)
            {
                logger.LogDebug(
                    "Releasing annotation lock for MedDataId {MedDataId}. AnnotationStarted: {AnnotationStarted}",
                    medDataId,
                    logoutDto.IsAnnotationStarted);

                await medDataRepository.UpdateLock(
                    medDataId,
                    logoutDto.KeywordStates ?? string.Empty,
                    logoutDto.IsAnnotationStarted,
                    isMedicalStudent);
            }

            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during logout");
            return Json(new { success = true, error = "Logout completed, but annotation lock cleanup failed." });
        }
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Signup()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToRoleBasedPage();
        }

        ViewBag.Specialities = Specialities;
        HandleTempDataErrors();

        if (TempData["FormData"] is string formDataJson)
        {
            var formData = JsonSerializer.Deserialize<SignupDto>(formDataJson);
            return View(formData);
        }

        return View();
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> PostSignup([FromForm] SignupDto signupDto)
    {
        try
        {
            logger.LogInformation("Starting signup process for email: {Email}", signupDto.Email);

            if (!ModelState.IsValid)
            {
                var validationErrors = ModelState.Values
                    .SelectMany(value => value.Errors.Select(error => error.ErrorMessage))
                    .ToList();

                logger.LogWarning("Model validation failed for signup: {Errors}", JsonSerializer.Serialize(validationErrors));
                TempData["Errors"] = validationErrors;
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
                Speciality = signupDto.Speciality != null ? string.Join(",", signupDto.Speciality) : null,
                BodyRegion = signupDto.BodyRegion != null ? string.Join(",", signupDto.BodyRegion) : null,
                ImageModality = signupDto.ImageModality != null ? string.Join(",", signupDto.ImageModality) : null,
                ClinicalExperience = signupDto.ClinicalExperience ?? 0,
                OrcidId = signupDto.OrcidId,
            };

            logger.LogInformation(
                "Attempting to create user: {User}",
                JsonSerializer.Serialize(new
                {
                    newUser.Email,
                    newUser.FullName,
                    newUser.Position,
                    newUser.Speciality
                }));

            var (succeeded, signupErrors) = await identityService.SignupAsync(newUser, signupDto.Password, null);
            if (succeeded)
            {
                var roleName = signupDto.Position?.Equals("medical student", StringComparison.OrdinalIgnoreCase) == true
                    ? "Medical_Student"
                    : "Professional";

                var roleResult = await userManager.AddToRoleAsync(newUser, roleName);
                if (!roleResult.Succeeded)
                {
                    logger.LogWarning(
                        "User created but role assignment failed for {Email}: {Errors}",
                        signupDto.Email,
                        string.Join(", ", roleResult.Errors.Select(error => error.Description)));

                    TempData["Errors"] = roleResult.Errors.Select(error => error.Description).ToList();
                    TempData["FormData"] = JsonSerializer.Serialize(signupDto);
                    return RedirectToAction(nameof(Signup));
                }

                logger.LogInformation("User created successfully and assigned role: {Role}", roleName);
                return RedirectToAction(nameof(Login));
            }

            logger.LogWarning(
                "User creation failed: {Errors}",
                signupErrors != null ? JsonSerializer.Serialize(signupErrors) : "No specific errors returned");

            var errorList = signupErrors?.ToList() ?? [];
            if (errorList.Count == 0)
            {
                errorList.Add("This email is already in use.");
            }

            TempData["Errors"] = errorList;
            TempData["FormData"] = JsonSerializer.Serialize(signupDto);

            return RedirectToAction(nameof(Signup));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception during signup process");
            TempData["Errors"] = new List<string> { "An unexpected error occurred during registration. Please try again." };
            TempData["FormData"] = JsonSerializer.Serialize(signupDto);
            return RedirectToAction(nameof(Signup));
        }
    }

    [AllowAnonymous]
    public IActionResult AccessDenied()
    {
        return View();
    }

    private IActionResult RedirectToRoleBasedPage()
    {
        logger.LogDebug(
            "RedirectToRoleBasedPage called. User: {User}, Authenticated: {Authenticated}",
            User.Identity?.Name,
            User.Identity?.IsAuthenticated);

        if (User.IsInRole("Medical_Student"))
        {
            return RedirectToAction("Student", "Home");
        }

        if (User.IsInRole("Professional"))
        {
            return RedirectToAction("Professional", "Home");
        }

        logger.LogWarning("User has no role assigned: {User}", User.Identity?.Name);
        TempData["Errors"] = new List<string> { "Your account doesn't have any assigned roles. Please contact the administrator." };
        return RedirectToAction("AccessDenied", "Identity");
    }

    private void HandleTempDataErrors()
    {
        var errors = TempData["Errors"] switch
        {
            string error => [error],
            IEnumerable<string> errorList => errorList.ToArray(),
            _ => []
        };

        foreach (var error in errors)
        {
            ModelState.AddModelError(string.Empty, error);
        }

    }
}
