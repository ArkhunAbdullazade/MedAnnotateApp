using System.Reflection;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using MedAnnotateApp.Infrastructure.Data;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Services;
using MedAnnotateApp.Infrastructure.Settings;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Infrastructure.Repositories;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

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

builder.Services.AddAuthorization();

builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("SmtpSettings"));

builder.Services.AddTransient<IEmailService, EmailService>();
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IMedDataRepository, MedDataRepository>();

var app = builder.Build();

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

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Identity}/{action=Login}/{id?}");

app.Run();
