using System.Reflection;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Data;
using MedAnnotateApp.Infrastructure.Repositories;
using MedAnnotateApp.Infrastructure.Services;
using MedAnnotateApp.Infrastructure.Settings;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

const string SeedDataFileName = "mockPMCMIDdata7.xlsx";

var builder = WebApplication.CreateBuilder(args);

var medDataConnectionString = builder.Configuration.GetConnectionString("MedDataDb");
if (string.IsNullOrWhiteSpace(medDataConnectionString))
{
    throw new InvalidOperationException("ConnectionStrings:MedDataDb must be configured before the application starts.");
}

var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    var keyDirectory = Directory.CreateDirectory(dataProtectionKeysPath);
    builder.Services.AddDataProtection().PersistKeysToFileSystem(keyDirectory);
}

builder.Services.AddSession(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.IdleTimeout = TimeSpan.FromHours(12);
});

builder.Services.AddControllersWithViews().AddSessionStateTempDataProvider();

builder.Services.AddDbContext<MedDataDbContext>(options =>
{
    options.UseNpgsql(
        medDataConnectionString,
        useSqlOptions => useSqlOptions.MigrationsAssembly(Assembly.GetExecutingAssembly().GetName().Name));
});

builder.Services.AddIdentity<User, IdentityRole>(options =>
{
    options.SignIn.RequireConfirmedAccount = false;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;
})
    .AddEntityFrameworkStores<MedDataDbContext>()
    .AddDefaultTokenProviders();

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
    options.ExpireTimeSpan = TimeSpan.FromHours(12);
});

builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("SmtpSettings"));

builder.Services.AddTransient<IEmailService, EmailService>();
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IMedDataRepository, MedDataRepository>();
builder.Services.AddScoped<IAnnotatedMedDataRepository, AnnotatedMedDataRepository>();
builder.Services.AddScoped<IAnnotatedByStudentsMedDataRepository, AnnotatedByStudentsMedDataRepository>();
builder.Services.AddScoped<IExcelLoaderService, ExcelLoaderService>();

var app = builder.Build();

await InitializeDatabaseAsync(app);

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();

    logger.LogDebug(
        "Current path: {Path}, Authenticated: {Authenticated}, User: {User}",
        path,
        context.User.Identity?.IsAuthenticated,
        context.User.Identity?.Name);

    if (ShouldAllowPath(path))
    {
        await next();
        return;
    }

    var isAuthenticated = context.User.Identity?.IsAuthenticated == true;
    if (isAuthenticated)
    {
        if (path is "/identity/login" or "/identity/signup" or "/identity/authorizationaccess")
        {
            var redirectPath = context.User.IsInRole("Medical_Student")
                ? "/Home/Student"
                : "/Home/Professional";

            context.Response.Redirect(redirectPath);
            return;
        }

        await next();
        return;
    }

    var hasAuthSession = context.Session.Keys.Contains("Authorized");
    if (hasAuthSession && IsLoginOrSignupPath(path))
    {
        await next();
        return;
    }

    context.Response.Redirect(hasAuthSession ? "/Identity/Login" : "/Identity/AuthorizationAccess");
});

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Identity}/{action=AuthorizationAccess}/{id?}");

app.Run();

async Task InitializeDatabaseAsync(WebApplication application)
{
    using var scope = application.Services.CreateScope();
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();

    try
    {
        var context = services.GetRequiredService<MedDataDbContext>();
        await context.Database.MigrateAsync();

        await EnsureRolesAsync(services, logger);

        if (await context.MedDatas.AnyAsync())
        {
            return;
        }

        var excelLoader = services.GetRequiredService<IExcelLoaderService>();
        var seedDataPath = Path.Combine(application.Environment.ContentRootPath, SeedDataFileName);
        if (!File.Exists(seedDataPath))
        {
            logger.LogWarning("Skipping seed data load because {SeedDataPath} was not found.", seedDataPath);
            return;
        }

        var medDataList = excelLoader.LoadMedDataFromExcel(seedDataPath);
        var medKeywordList = excelLoader.LoadMedKeywordsFromExcel(seedDataPath);

        await context.MedDatas.AddRangeAsync(medDataList);
        await context.SaveChangesAsync();

        var medDataKeywords = medKeywordList.Select(item => new MedDataKeyword
        {
            MedDataId = item.MedDataId,
            Keyword = item.Keyword
        });

        await context.MedDataKeywords.AddRangeAsync(medDataKeywords);
        await context.SaveChangesAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred during database migration or seed data loading.");
    }
}

static async Task EnsureRolesAsync(IServiceProvider services, ILogger logger)
{
    var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
    string[] roles = ["Medical_Student", "Professional"];

    foreach (var roleName in roles)
    {
        if (await roleManager.RoleExistsAsync(roleName))
        {
            continue;
        }

        var result = await roleManager.CreateAsync(new IdentityRole(roleName));
        if (!result.Succeeded)
        {
            logger.LogWarning(
                "Could not create role {Role}: {Errors}",
                roleName,
                string.Join(", ", result.Errors.Select(error => error.Description)));
        }
    }
}

static bool ShouldAllowPath(string path)
{
    if (string.IsNullOrEmpty(path))
    {
        return false;
    }

    if (path.StartsWith("/lib/") ||
        path.StartsWith("/css/") ||
        path.StartsWith("/js/") ||
        path.StartsWith("/images/") ||
        path.StartsWith("/favicon.ico"))
    {
        return true;
    }

    string[] allowedPaths =
    [
        "/identity/authorizationaccess",
        "/identity/postauthorizationaccess",
        "/identity/accessdenied",
        "/home/error"
    ];

    return allowedPaths.Contains(path);
}

static bool IsLoginOrSignupPath(string path)
{
    if (string.IsNullOrEmpty(path))
    {
        return false;
    }

    string[] loginOrSignupPaths =
    [
        "/identity/login",
        "/identity/postlogin",
        "/identity/signup",
        "/identity/postsignup"
    ];

    return loginOrSignupPaths.Contains(path);
}
