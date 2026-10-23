using System.Reflection;
using System.Net;
using System.Threading.RateLimiting;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Data;
using MedAnnotateApp.Infrastructure.Repositories;
using MedAnnotateApp.Infrastructure.Services;
using MedAnnotateApp.Infrastructure.Settings;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

const string SeedDataFileName = "mockPMCMIDdata7.xlsx";
const string ResetPasswordCommand = "reset-password";

// Operator-only shell command, never an HTTP endpoint: `dotnet MedAnnotateApp.Presentation.dll reset-password <email>`.
var resetPasswordEmail = args is [ResetPasswordCommand, var email] ? email : null;
if (args.Length > 0 && args[0] == ResetPasswordCommand && resetPasswordEmail is null)
{
    Console.Error.WriteLine($"Usage: {ResetPasswordCommand} <account-email>");
    Environment.ExitCode = 2;
    return;
}
var isOperatorCommand = resetPasswordEmail is not null;

var builder = WebApplication.CreateBuilder(isOperatorCommand ? [] : args);
if (builder.Environment.IsDevelopment())
{
    // Keep workstation database credentials outside tracked configuration files.
    builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true)
        .AddEnvironmentVariables().AddCommandLine(args);
}

var medDataConnectionString = builder.Configuration.GetConnectionString("MedDataDb");
if (string.IsNullOrWhiteSpace(medDataConnectionString))
{
    throw new InvalidOperationException("ConnectionStrings:MedDataDb must be configured before the application starts.");
}
if (!builder.Environment.IsDevelopment() && !isOperatorCommand && string.IsNullOrWhiteSpace(builder.Configuration["AuthorizationAccessPasswordHash"]))
{
    throw new InvalidOperationException("Configure AuthorizationAccessPasswordHash before deploying the research access gate.");
}

var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
if (!builder.Environment.IsDevelopment() && !isOperatorCommand && string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    throw new InvalidOperationException("Configure persistent DataProtection:KeysPath before deploying.");
}
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    var keyDirectory = Directory.CreateDirectory(dataProtectionKeysPath);
    builder.Services.AddDataProtection().PersistKeysToFileSystem(keyDirectory);
}

builder.Services.AddDistributedMemoryCache(); // One web instance; session loss requires entering the shared gate again.
builder.Services.AddSession(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.IdleTimeout = TimeSpan.FromHours(12);
});

builder.Services.AddControllersWithViews(options => options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()))
    .AddSessionStateTempDataProvider();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    foreach (var address in builder.Configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [])
        options.KnownProxies.Add(IPAddress.Parse(address));
});
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("research-access", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30, Window = TimeSpan.FromMinutes(10), QueueLimit = 0, AutoReplenishment = true
        }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
        await context.HttpContext.Response.WriteAsync("Too many access attempts. Wait ten minutes and try again.", token);
});

builder.Services.AddDbContext<MedDataDbContext>(options =>
{
    options.UseNpgsql(
        medDataConnectionString,
        useSqlOptions => useSqlOptions.MigrationsAssembly(Assembly.GetExecutingAssembly().GetName().Name));
});

builder.Services.AddIdentity<User, IdentityRole>(options =>
{
    options.SignIn.RequireConfirmedAccount = false;
    options.SignIn.RequireConfirmedEmail = false;
    options.User.RequireUniqueEmail = true;
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
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.Cookie.Name = "MedAnnotateAuth";
    options.SlidingExpiration = true;
    options.ExpireTimeSpan = TimeSpan.FromHours(12);
    options.Events.OnRedirectToLogin = context =>
    {
        if (context.Request.Path.StartsWithSegments("/MedData"))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return context.Response.WriteAsJsonAsync(new { success = false, message = "Your session has ended. Sign in again before retrying the save." });
        }
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        if (context.Request.Path.StartsWithSegments("/MedData"))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return context.Response.WriteAsJsonAsync(new { success = false, message = "Your account is not allowed to perform this action." });
        }
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
});

builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("SmtpSettings"));

builder.Services.AddTransient<IEmailService, EmailService>();
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IMedDataRepository, MedDataRepository>();
builder.Services.AddScoped<IAnnotatedMedDataRepository, AnnotatedMedDataRepository>();
builder.Services.AddScoped<IAnnotatedByStudentsMedDataRepository, AnnotatedByStudentsMedDataRepository>();
builder.Services.AddScoped<IExcelLoaderService, ExcelLoaderService>();

var app = builder.Build();

if (isOperatorCommand)
{
    // Runs before database initialization, so it can never migrate or seed the target database.
    using var scope = app.Services.CreateScope();
    var (succeeded, temporaryPassword, errors) = await scope.ServiceProvider
        .GetRequiredService<IIdentityService>().ResetPasswordAsync(resetPasswordEmail);
    Console.WriteLine(succeeded
        ? $"Temporary password: {temporaryPassword}{Environment.NewLine}Share it privately. Saved work and assignments are unchanged."
        : string.Join(Environment.NewLine, errors ?? []));
    Environment.ExitCode = succeeded ? 0 : 1;
    return;
}

await InitializeDatabaseAsync(app);

app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers.XFrameOptions = "DENY";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    await next();
});
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
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
app.MapGet("/health/ready", async (MedDataDbContext context, CancellationToken cancellationToken) =>
    await context.Database.CanConnectAsync(cancellationToken)
        ? Results.Ok(new { status = "ready" })
        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable)).AllowAnonymous();

app.Run();

async Task InitializeDatabaseAsync(WebApplication application)
{
    using var scope = application.Services.CreateScope();
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();

    try
    {
        var context = services.GetRequiredService<MedDataDbContext>();
        var applyMigrations = application.Configuration.GetValue<bool?>("Database:ApplyMigrations")
            ?? application.Environment.IsDevelopment();
        if (applyMigrations) await context.Database.MigrateAsync();
        else if ((await context.Database.GetPendingMigrationsAsync()).Any())
            throw new InvalidOperationException("Database migrations are pending. Back up the database and apply the reviewed migration script before starting production.");

        await EnsureRolesAsync(services, logger);

        if (!application.Configuration.GetValue<bool>("Database:SeedExcel") || await context.MedDatas.AnyAsync())
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
        throw;
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
            throw new InvalidOperationException($"Could not initialize role {roleName}.");
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
        "/health/ready",
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
