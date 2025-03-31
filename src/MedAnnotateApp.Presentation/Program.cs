using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using MedAnnotateApp.Infrastructure.Data;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Services;
using MedAnnotateApp.Infrastructure.Settings;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Infrastructure.Repositories;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging;

var builder = WebApplication.CreateBuilder(args);

// Configure session state with reasonable timeout
builder.Services.AddSession(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.IdleTimeout = TimeSpan.FromHours(12); // 12 hours is a reasonable balance
});

// Add TempData provider with Session
builder.Services.AddControllersWithViews().AddSessionStateTempDataProvider();

// Configure database
builder.Services.AddDbContext<MedDataDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("MedDataDb"),
        useSqlOptions => { useSqlOptions.MigrationsAssembly(Assembly.GetExecutingAssembly().GetName().Name); }
    );
});

// Configure identity
builder.Services.AddIdentity<User, IdentityRole>(options => {
    options.SignIn.RequireConfirmedAccount = false;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;
})
    .AddEntityFrameworkStores<MedDataDbContext>()
    .AddDefaultTokenProviders();

// Configure cookie settings
builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Identity/Login";
    options.AccessDeniedPath = "/Identity/AccessDenied";
    options.LogoutPath = "/Identity/Logout";
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.Cookie.Name = "MedAnnotateAuth";
    options.SlidingExpiration = true;
    // Set a reasonable expiration time to match session timeout
    options.ExpireTimeSpan = TimeSpan.FromHours(12);
});

// Configure email settings
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("SmtpSettings"));

// Register services
builder.Services.AddTransient<IEmailService, EmailService>();
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IMedDataRepository, MedDataRepository>();
builder.Services.AddScoped<IAnnotatedMedDataRepository, AnnotatedMedDataRepository>();
builder.Services.AddScoped<IAnnotatedByStudentsMedDataRepository, AnnotatedByStudentsMedDataRepository>();
builder.Services.AddScoped<IExcelLoaderService, ExcelLoaderService>();

var app = builder.Build();

// Database migration and seeding
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<MedDataDbContext>();
        context.Database.Migrate();

        // Create roles if they don't exist
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        
        string[] roles = { "Medical_Student", "Professional" };
        foreach (var roleName in roles)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new IdentityRole(roleName));
            }
        }

        var excelLoader = services.GetRequiredService<IExcelLoaderService>();

        var medDataList = excelLoader.LoadMedDataFromExcel("./mockPMCMIDdata7.xlsx");
        var medKeywordList = excelLoader.LoadMedKeywordsFromExcel("./mockPMCMIDdata7.xlsx");
        
        if (!context.MedDatas.Any())
        {
            foreach (var medData in medDataList)
            {
                await context.MedDatas.AddAsync(medData);
            }

            await context.SaveChangesAsync();

            foreach (var (medDataId, keyword) in medKeywordList)
            {
                var medDataKeyword = new MedDataKeyword
                {
                    MedDataId = medDataId,
                    Keyword = keyword
                };

                await context.MedDataKeywords.AddAsync(medDataKeyword);
            }

            await context.SaveChangesAsync();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"An error occurred during migration: {ex.Message}");
    }
}

// Configure the HTTP request pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

// Session must be before Authentication AND Authorization
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

// Custom authorization gate middleware - MUST come AFTER authentication
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value?.ToLower();
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    
    // Log the current path and authentication details for debugging
    logger.LogInformation("Current path: {Path}, Auth: {Auth}, User: {User}", 
        path, 
        context.User?.Identity?.IsAuthenticated,
        context.User?.Identity?.Name);
    
    // Skip middleware for static files and allowed paths
    if (ShouldAllowPath(path))
    {
        await next();
        return;
    }
    
    // Allow authenticated users to access any page except the login/signup/auth pages
    // This prevents redirect loops for authenticated users
    bool isAuthenticated = context.User?.Identity?.IsAuthenticated ?? false;
    if (isAuthenticated)
    {
        // If an authenticated user tries to access login/signup/auth pages, 
        // redirect them to their role-specific page instead
        if (path == "/identity/login" || 
            path == "/identity/signup" || 
            path == "/identity/authorizationaccess")
        {
            // Determine role and redirect
            bool isMedicalStudent = context.User.IsInRole("Medical_Student");
            if (isMedicalStudent)
            {
                logger.LogInformation("Redirecting authenticated user to Student page");
                context.Response.Redirect("/Home/Student");
            }
            else
            {
                logger.LogInformation("Redirecting authenticated user to Professional page");
                context.Response.Redirect("/Home/Professional");
            }
            return;
        }
        
        // For all other paths, let the authenticated user through
        await next();
        return;
    }
    
    // Check if they've passed the authorization gate
    bool hasAuthSession = context.Session.Keys.Contains("Authorized");
    
    // Allow users with auth session to access login/signup
    if (hasAuthSession && IsLoginOrSignupPath(path))
    {
        await next();
        return;
    }
    
    // Redirect based on authorization state
    if (!hasAuthSession)
    {
        context.Response.Redirect("/Identity/AuthorizationAccess");
    }
    else
    {
        context.Response.Redirect("/Identity/Login");
    }
});

// Map routes
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Identity}/{action=AuthorizationAccess}/{id?}");

app.Run();

// Helper methods for the middleware
bool ShouldAllowPath(string path)
{
    if (string.IsNullOrEmpty(path)) return false;
    
    // Static files check
    if (path.StartsWith("/lib/") || 
        path.StartsWith("/css/") || 
        path.StartsWith("/js/") || 
        path.StartsWith("/images/") ||
        path.StartsWith("/favicon.ico"))
    {
        return true;
    }
    
    // Check for specifically allowed paths
    string[] allowedPaths = {
        "/identity/authorizationaccess",
        "/identity/postauthorizationaccess", 
        "/identity/accessdenied",
        "/home/error"
    };
    
    return allowedPaths.Contains(path);
}

bool IsLoginOrSignupPath(string path)
{
    if (string.IsNullOrEmpty(path)) return false;
    
    string[] loginOrSignupPaths = {
        "/identity/login",
        "/identity/postlogin",
        "/identity/signup",
        "/identity/postsignup"
    };
    
    return loginOrSignupPaths.Contains(path);
}
