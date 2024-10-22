using System.Security.Policy;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Services;
using Microsoft.AspNetCore.Identity;
using System.Threading.Tasks;

namespace MedAnnotateApp.Infrastructure.Services;

public class IdentityService : IIdentityService
{
    private readonly UserManager<User> userManager;
    private readonly SignInManager<User> signInManager;
    private readonly RoleManager<IdentityRole> roleManager;
    private readonly IEmailService emailService;

    public IdentityService(UserManager<User> userManager, SignInManager<User> signInManager, RoleManager<IdentityRole> roleManager, IEmailService emailService)
    {
        this.userManager = userManager;
        this.signInManager = signInManager;
        this.roleManager = roleManager;
        this.emailService = emailService;
    }

    public async Task<(bool Succeeded, IEnumerable<string>? Errors)> SignupAsync(User user, string? password, string? confirmationUrl)
    {
        var result = await this.userManager.CreateAsync(user, password!);

        // if (result.Succeeded)
        // {
            // var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
            // var fullConfirmationLink = $"{confirmationUrl}?userId={user.Id}&token={token}";

            // await emailService.SendEmailAsync(user.Email!, "Confirm your email", $"Please confirm your account by clicking this link: <a href='{fullConfirmationLink}'>link</a>");
        
            return (true, null);
        // }

        // return (false, result.Errors.Select(e => e.Description).ToArray());
    }

    public async Task<(bool Succeeded, IEnumerable<string>? Errors)> LoginAsync(string? email, string? password)
    {
        var result = await signInManager.PasswordSignInAsync(email, password, false, false);

        return result.Succeeded ? (true, null) : (false, ["Invalid login attempt."]);
    }

    public async Task<bool> ConfirmEmailAsync(string? userId, string? token)
    {
        var user = await userManager.FindByIdAsync(userId!);

        if (user == null) return false; 

        var result = await userManager.ConfirmEmailAsync(user, token!);

        return result.Succeeded;
    }

    public async Task SignoutAsync()
    {
        throw new NotImplementedException();
    }
}