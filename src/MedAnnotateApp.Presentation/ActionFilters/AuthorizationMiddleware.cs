using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;
using System;
using Microsoft.Extensions.Logging;
using System.Text;

namespace MedAnnotateApp.Presentation.ActionFilters
{
    public class AuthorizationMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<AuthorizationMiddleware> _logger;
        
        // Paths that should completely bypass this middleware
        private static readonly string[] BypassPaths = new[]
        {
            "/identity",
            "/identity/",
            "/identity/authorizationaccess",
            "/identity/postauthorizationaccess",
            "/identity/login",
            "/identity/postlogin",
            "/identity/signup",
            "/identity/postsignup",
            "/identity/accessdenied",
            "/identity/logout",
            "/",
            "/home",
            "/home/",
            "/home/index"
        };
        
        public AuthorizationMiddleware(RequestDelegate next, ILogger<AuthorizationMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Get the lowercase path for case-insensitive comparison
            string path = context.Request.Path.Value?.ToLower() ?? "";
            _logger.LogInformation($"Auth middleware processing: {path}");
            
            // ALWAYS bypass this middleware for Identity controller and static resources
            if (ShouldBypass(path))
            {
                _logger.LogInformation($"Bypassing auth middleware for: {path}");
                await _next(context);
                return;
            }
            
            // If user is already authenticated, let them through
            if (context.User?.Identity?.IsAuthenticated == true)
            {
                _logger.LogInformation($"User authenticated, proceeding: {path}");
                await _next(context);
                return;
            }
            
            // Check if they've passed the authorization gate
            bool isAuthorized = context.Session.Keys.Contains("Authorized");
            
            // Implement redirect behavior based on authorization status
            if (!isAuthorized)
            {
                // Not passing the auth check, direct to authorization page
                _logger.LogInformation($"User not authorized, redirecting: {path}");
                context.Response.Redirect("/Identity/AuthorizationAccess", false);
                return;
            }
            
            // User is authorized by session but not logged in, redirect to login
            _logger.LogInformation($"User authorized but not authenticated, redirecting to login: {path}");
            context.Response.Redirect("/Identity/Login", false);
            return;
        }
        
        private bool ShouldBypass(string path)
        {
            // Bypass static resources
            if (IsStaticResource(path) || path.StartsWith("/api/"))
            {
                return true;
            }
            
            // Bypass Identity controller and other excluded paths
            foreach (var bypassPath in BypassPaths)
            {
                if (path.Equals(bypassPath, StringComparison.OrdinalIgnoreCase) || 
                    path.StartsWith(bypassPath + "/", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            
            return false;
        }
        
        private bool IsStaticResource(string path)
        {
            return path.StartsWith("/lib/") || 
                   path.StartsWith("/css/") || 
                   path.StartsWith("/js/") ||
                   path.StartsWith("/img/") ||
                   path.StartsWith("/favicon") ||
                   path.EndsWith(".png") ||
                   path.EndsWith(".jpg") ||
                   path.EndsWith(".jpeg") ||
                   path.EndsWith(".gif") ||
                   path.EndsWith(".svg") ||
                   path.EndsWith(".woff") ||
                   path.EndsWith(".woff2") ||
                   path.EndsWith(".ttf") ||
                   path.EndsWith(".eot") ||
                   path.EndsWith(".ico");
        }
    }
    
    // Extension method to register the middleware
    public static class AuthorizationMiddlewareExtensions
    {
        public static IApplicationBuilder UseAuthorizationGate(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<AuthorizationMiddleware>();
        }
    }
} 