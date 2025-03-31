using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MedAnnotateApp.Presentation.Models;
using Microsoft.AspNetCore.Authorization;
using MedAnnotateApp.Core.Repositories;
using Microsoft.AspNetCore.Identity;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Infrastructure.Data;
using System.Security.Claims;

namespace MedAnnotateApp.Presentation.Controllers;

public class HomeController : Controller
{
    private readonly IMedDataRepository _medDataRepository;
    private readonly UserManager<User> _userManager;
    private readonly MedDataDbContext _context;
    private readonly ILogger<HomeController> _logger;

    public HomeController(
        IMedDataRepository medDataRepository, 
        UserManager<User> userManager, 
        MedDataDbContext context,
        ILogger<HomeController> logger)
    {
        _medDataRepository = medDataRepository;
        _userManager = userManager;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Handles the main route, redirecting to appropriate actions based on authentication
    /// </summary>
    [AllowAnonymous]
    public IActionResult Index()
    {
        // If user is authenticated, redirect to role-specific page
        if (User.Identity?.IsAuthenticated == true)
        {
            // Check for specific roles
            if (User.IsInRole("Medical_Student"))
            {
                return RedirectToAction(nameof(Student));
            }
            else if (User.IsInRole("Professional"))
            {
                return RedirectToAction(nameof(Professional));
            }
            else
            {
                // User is authenticated but has no role, show an error
                _logger.LogWarning("User is authenticated but has no role");
                TempData["ErrorMessage"] = "Your account doesn't have any assigned roles. Please contact the administrator.";
                return View("Error", new ErrorViewModel 
                { 
                    RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier,
                    ErrorMessage = "Authentication error: No valid role assigned to your account"
                });
            }
        }
        
        // Check if they've passed the authorization gate
        bool hasAuthSession = HttpContext.Session.Keys.Contains("Authorized");
        
        // If they have passed the gate, redirect to login
        if (hasAuthSession)
        {
            return RedirectToAction("Login", "Identity");
        }
        
        // Otherwise, redirect to authorization gate
        return RedirectToAction("AuthorizationAccess", "Identity");
    }

    /// <summary>
    /// Displays the professional view for users with the Professional role
    /// </summary>
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> Professional()
    {
        try
        {
            // Log detailed authentication information
            _logger.LogInformation("Professional action - Auth: {Auth}, User: {User}, Roles: {Roles}",
                User.Identity?.IsAuthenticated,
                User.Identity?.Name,
                string.Join(", ", User.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value)));
            
            // Ensure the user is authenticated
            if (!User.Identity?.IsAuthenticated ?? true)
            {
                _logger.LogWarning("Unauthenticated user attempted to access Professional action");
                return RedirectToAction("Login", "Identity");
            }

            // Verify the user has the Professional role
            if (!User.IsInRole("Professional"))
            {
                _logger.LogWarning("User without Professional role attempted to access Professional action");
                return RedirectToAction("AccessDenied", "Identity");
            }

            // Get the user
            var user = await _userManager.GetUserAsync(User);
            
            if (user == null)
            {
                _logger.LogWarning("User is null in Professional action despite authenticated user");
                return RedirectToAction("Login", "Identity");
            }

            // Get medical data for this user
            var (medData, counter) = await _medDataRepository.GetNthMedDataBySpecialityAndPositionAsync(
                user.Speciality!, user.Position!, user.BodyRegion!, user.ImageModality!, user.Id!);

            ViewBag.Counter = counter;

            if (medData != null) 
            {
                ViewBag.MedDataKeywords = (await _medDataRepository.GetKeywordsByMedDataIdAsync(medData.Id)).ToList();
            }
            else 
            {
                ViewBag.MedDataKeywords = null;
            }

            // Return the view with the data
            return View(medData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in Professional action");
            return RedirectToAction("Error");
        }
    }

    /// <summary>
    /// Displays the student view for users with the Medical_Student role
    /// </summary>
    [Authorize(Roles = "Medical_Student")]
    public async Task<IActionResult> Student()
    {
        try
        {
            // Ensure the user is authenticated
            if (!User.Identity?.IsAuthenticated ?? true)
            {
                _logger.LogWarning("Unauthenticated user attempted to access Student action");
                return RedirectToAction("Login", "Identity");
            }

            // Verify the user has the Medical_Student role
            if (!User.IsInRole("Medical_Student"))
            {
                _logger.LogWarning("User without Medical_Student role attempted to access Student action");
                return RedirectToAction("AccessDenied", "Identity");
            }

            // Get the user
            var user = await _userManager.GetUserAsync(User);
            
            if (user == null)
            {
                _logger.LogWarning("User is null in Student action despite authenticated user");
                return RedirectToAction("Login", "Identity");
            }

            // Get medical data for this user
            var (medData, counter) = await _medDataRepository.GetNthMedDataBySpecialityAndPositionAsync(
                user.Speciality!, user.Position!, user.BodyRegion!, user.ImageModality!, user.Id!);

            ViewBag.Counter = counter;

            if (medData != null) 
            {
                ViewBag.MedDataKeywords = (await _medDataRepository.GetKeywordsByMedDataIdAsync(medData.Id)).ToList();
            }
            else 
            {
                ViewBag.MedDataKeywords = null;
            }

            // Return the view with the data
            return View(medData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in Student action");
            return RedirectToAction("Error");
        }
    }

    /// <summary>
    /// Displays error page for application errors
    /// </summary>
    [AllowAnonymous]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
