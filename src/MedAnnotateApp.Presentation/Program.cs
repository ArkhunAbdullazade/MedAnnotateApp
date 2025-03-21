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
using MedAnnotateApp.Presentation.ActionFilters;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);

// Add Redis for Session and TempData management
// builder.Services.AddStackExchangeRedisCache(options =>
// {
//     options.Configuration = builder.Configuration.GetValue<string>("RedisConnection") ?? "redis:6379";
// });

// Configure session state with Redis
builder.Services.AddSession(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.IdleTimeout = TimeSpan.FromMinutes(30); // Customize the timeout as needed
});

// Add TempData provider with Session
builder.Services.AddControllersWithViews().AddSessionStateTempDataProvider();

builder.Services.AddDbContext<MedDataDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("MedDataDb"),
        useSqlOptions => { useSqlOptions.MigrationsAssembly(Assembly.GetExecutingAssembly().GetName().Name); }
    );
});

builder.Services.AddIdentity<User, IdentityRole>(options => {
    options.SignIn.RequireConfirmedAccount = false;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;
})
    .AddEntityFrameworkStores<MedDataDbContext>()
    .AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(options =>
    {
        options.LoginPath = "/Identity/AuthorizationAccess";
        options.SlidingExpiration = true;
    });

builder.Services.AddAuthorization();

// Add persistent data protection keys
// builder.Services.AddDataProtection()
//             .PersistKeysToFileSystem(new DirectoryInfo(@"/app/keys"))
//             .SetApplicationName("MedAnnotateApplication");

builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("SmtpSettings"));

builder.Services.AddScoped<AuthorizationAccessFilter>(); 
builder.Services.AddTransient<IEmailService, EmailService>();
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IMedDataRepository, MedDataRepository>();
builder.Services.AddScoped<IAnnotatedMedDataRepository, AnnotatedMedDataRepository>();
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

if (app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseSession();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Identity}/{action=AuthorizationAccess}/{id?}");

app.Run();
