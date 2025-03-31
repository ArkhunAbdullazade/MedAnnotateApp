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
    private readonly IMedDataRepository _medDataRepository;
    private readonly IIdentityService _identityService;
    private readonly UserManager<User> _userManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<IdentityController> _logger;

    public IdentityController(
        IMedDataRepository medDataRepository, 
        IIdentityService identityService, 
        UserManager<User> userManager, 
        IConfiguration configuration,
        ILogger<IdentityController> logger)
    {
        _medDataRepository = medDataRepository;
        _identityService = identityService;
        _userManager = userManager;
        _configuration = configuration;
        _logger = logger;
    }

    #region Authorization Gate
    
    /// <summary>
    /// Handles the initial authorization gate that protects the application
    /// </summary>
    [AllowAnonymous]
    public IActionResult AuthorizationAccess()
    {
        // If user is already authenticated, redirect to role-specific page
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToRoleBasedPage();
        }
        
        // If already authorized via session, direct to login
        if (HttpContext.Session.Keys.Contains("Authorized"))
        {
            return RedirectToAction(nameof(Login));
        }

        // Clear model state when displaying the authorization form
        ModelState.Clear();
        
        // Handle form errors from previous attempts
        HandleTempDataErrors();

        return View();
    }

    /// <summary>
    /// Processes the authorization password form
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public IActionResult PostAuthorizationAccess(AuthorizationAccessDto authDto)
    {
        _logger.LogInformation("Authorization access attempt");
        
        if (!ModelState.IsValid)
        {
            _logger.LogWarning("Authorization access validation failed: {Errors}", 
                string.Join(", ", ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage)));
                    
            return View("AuthorizationAccess", authDto);
        }

        var hashedPassword = _configuration["AuthorizationAccessPasswordHash"];
        if (AuthorizationAccessPasswordService.VerifyPassword(authDto.Password!, hashedPassword!))
        {
            _logger.LogInformation("Authorization access granted");
            // Set a simple flag in session
            HttpContext.Session.SetString("Authorized", "true");
            return RedirectToAction(nameof(Login));
        }

        _logger.LogWarning("Authorization access denied - incorrect password");
        ModelState.AddModelError(string.Empty, "The password you entered is incorrect. Please try again.");
        return View("AuthorizationAccess", authDto);
    }
    
    #endregion
    
    #region Authentication
    
    /// <summary>
    /// Displays the login page if user has passed authorization gate
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public IActionResult Login(string returnUrl = null)
    {
        // If already logged in, redirect to role-specific page
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToRoleBasedPage();
        }
        
        // Save valid return URL
        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            TempData["ReturnUrl"] = returnUrl;
        }

        // Clear model state when displaying the login form
        ModelState.Clear();
        
        // Handle errors from previous login attempts
        HandleTempDataErrors();

        return View();
    }

    /// <summary>
    /// Processes login attempts
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> PostLogin(LoginDto loginDto)
    {
        _logger.LogInformation("Login attempt for email: {Email}", loginDto.Email);
        
        // Check model validity first
        if (!ModelState.IsValid)
        {
            _logger.LogWarning("Login form validation failed");
            return View("Login", loginDto);
        }

        // Try to log in using the identity service
        var (succeeded, errors) = await _identityService.LoginAsync(loginDto.Email!, loginDto.Password!);

        if (succeeded)
        {
            _logger.LogInformation("User logged in successfully: {Email}", loginDto.Email);
            
            // Check if we have a return URL
            if (TempData["ReturnUrl"] is string returnUrl && !string.IsNullOrEmpty(returnUrl))
            {
                if (Url.IsLocalUrl(returnUrl))
                {
                    return Redirect(returnUrl);
                }
            }
            
            return RedirectToRoleBasedPage();
        }

        // If we get here, login failed
        _logger.LogWarning("Login failed for {Email}: {Errors}", 
            loginDto.Email, 
            errors != null && errors.Any() ? string.Join(", ", errors) : "No specific errors returned");
        
        // Add errors directly to ModelState
        if (errors != null && errors.Any())
        {
            foreach (var error in errors)
            {
                ModelState.AddModelError(string.Empty, error);
            }
        }
        else
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password. Please try again.");
        }
        
        // Return to the login view with the model and errors
        return View("Login", loginDto);
    }

    /// <summary>
    /// Handles user logout
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] LogoutDto logoutDto)
    {
        try
        {
            await _identityService.SignoutAsync();
            HttpContext.Session.Clear();

            _logger.LogInformation("LogoutDto: {LogoutDto}", logoutDto);

            System.Console.WriteLine("User.IsInRole(Medical_Student): {0}", User.IsInRole("Medical_Student"));
            System.Console.WriteLine("logoutDto.IsAnnotationStarted: {0}", logoutDto.IsAnnotationStarted);
            System.Console.WriteLine("logoutDto.KeywordStates: {0}", logoutDto.KeywordStates);
            System.Console.WriteLine("logoutDto.MedDataId: {0}", logoutDto.MedDataId.Value);
            if (logoutDto.MedDataId != null)
            {
                await _medDataRepository.UpdateLock(logoutDto.MedDataId.Value, logoutDto.KeywordStates ?? "", logoutDto.IsAnnotationStarted, User.IsInRole("Medical_Student"));
            }
        
            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during logout");
            // Still return success to ensure the frontend redirects the user
            return Json(new { success = true, error = ex.Message });
        }
    }
    
    #endregion
    
    #region Registration
    
    /// <summary>
    /// Displays the signup page
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public IActionResult Signup()
    {
        // If already logged in, redirect to role-specific page
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToRoleBasedPage();
        }

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

        // Handle form errors from previous attempts
        HandleTempDataErrors();

        if (TempData["FormData"] is string formDataJson)
        {
            var formData = JsonSerializer.Deserialize<SignupDto>(formDataJson);
            return View(formData);
        }

        return View();
    }

    /// <summary>
    /// Processes user signup submissions
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> PostSignup([FromForm] SignupDto signupDto)
    {
        try
        {
            _logger.LogInformation("Starting signup process for email: {Email}", signupDto.Email);
            
            if (!ModelState.IsValid)
            {
                var validationErrors = ModelState.Values
                    .SelectMany(v => v.Errors.Select(e => e.ErrorMessage))
                    .ToList();
                
                _logger.LogWarning("Model validation failed for signup: {Errors}", JsonSerializer.Serialize(validationErrors));
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

            _logger.LogInformation("Attempting to create user: {User}", JsonSerializer.Serialize(new { 
                newUser.Email, 
                newUser.FullName, 
                newUser.Position, 
                newUser.Speciality 
            }));
            
            var (succeeded, signupErrors) = await _identityService.SignupAsync(newUser, signupDto.Password!, null!);

            if (succeeded)
            {
                // Assign role based on position
                string roleName = signupDto.Position?.ToLower() == "medical student" 
                    ? "Medical_Student" 
                    : "Professional";

                _logger.LogInformation("User created successfully. Assigning role: {Role}", roleName);
                await _userManager.AddToRoleAsync(newUser, roleName);
                
                return RedirectToAction(nameof(Login));
            }

            // Add errors to TempData and redirect to GET Signup
            _logger.LogWarning("User creation failed: {Errors}", signupErrors != null ? JsonSerializer.Serialize(signupErrors) : "No specific errors returned");
            
            var errorList = new List<string>();
            if (signupErrors != null)
            {
                errorList.AddRange(signupErrors);
            }
            
            if (errorList.Count == 0)
            {
                errorList.Add("This Email is Already in Use");
            }
            
            TempData["Errors"] = errorList;
            TempData["FormData"] = JsonSerializer.Serialize(signupDto);

            return RedirectToAction(nameof(Signup));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception during signup process");
            TempData["Errors"] = new List<string> { "An unexpected error occurred during registration. Please try again." };
            TempData["FormData"] = JsonSerializer.Serialize(signupDto);
            return RedirectToAction(nameof(Signup));
        }
    }
    
    #endregion
    
    #region Error Handling
    
    /// <summary>
    /// Displays access denied page
    /// </summary>
    [AllowAnonymous]
    public IActionResult AccessDenied()
    {
        return View();
    }
    
    #endregion
    
    #region Helper Methods
    
    /// <summary>
    /// Helper method to redirect to the appropriate role-based page
    /// </summary>
    private IActionResult RedirectToRoleBasedPage()
    {
        // Debug logging to track roles
        _logger.LogInformation("RedirectToRoleBasedPage called. User: {User}, Authenticated: {Auth}",
            User.Identity?.Name, User.Identity?.IsAuthenticated);
        
        if (User.IsInRole("Medical_Student"))
        {
            _logger.LogInformation("User is in Medical_Student role, redirecting to Student page");
            return RedirectToAction("Student", "Home");
        }
        
        if (User.IsInRole("Professional"))
        {
            _logger.LogInformation("User is in Professional role, redirecting to Professional page");
            return RedirectToAction("Professional", "Home");
        }
        
        // If user has no role, show error
        _logger.LogWarning("User has no role assigned: {User}", User.Identity?.Name);
        TempData["Errors"] = new List<string> { "Your account doesn't have any assigned roles. Please contact the administrator." };
        return RedirectToAction("AccessDenied", "Identity");
    }
    
    /// <summary>
    /// Helper method to handle errors stored in TempData
    /// </summary>
    private void HandleTempDataErrors()
    {
        try
        {
            // Debug information to trace error handling flow
            _logger.LogDebug("HandleTempDataErrors called. TempData contains errors: {HasErrors}", 
                TempData.ContainsKey("Errors"));
                
            if (TempData["Errors"] is List<string> errors && errors.Any())
            {
                _logger.LogDebug("Processing {Count} errors from TempData", errors.Count);
                foreach (var error in errors)
                {
                    ModelState.AddModelError(string.Empty, error);
                }
                
                // Instead of removing errors immediately, keep them in TempData but mark as 'peeked'
                // This preserves them for the current request but allows them to be read in views
                TempData.Keep("Errors");
            }
            else
            {
                _logger.LogDebug("No errors found in TempData or errors collection was empty");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling TempData errors");
        }
    }
    
    #endregion
}
