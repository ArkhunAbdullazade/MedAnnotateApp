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

        if(!result.Succeeded) return (false, result.Errors.Select(e => e.Description).ToArray());

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
        // Validate that email is not null or empty
        if (string.IsNullOrWhiteSpace(email))
        {
            return (false, ["Email address is required."]);
        }

        // Validate that password is not null or empty
        if (string.IsNullOrWhiteSpace(password))
        {
            return (false, ["Password is required."]);
        }

        var user = await userManager.FindByEmailAsync(email);

        // Specific message when email is not found
        if (user == null)
        {
            return (false, ["The email address you entered does not exist in our system."]);
        }

        // Check password but don't lock the account
        var result = await signInManager.PasswordSignInAsync(user, password, isPersistent: false, lockoutOnFailure: false);

        if (result.Succeeded)
        {
            return (true, null);
        }
        else if (result.IsLockedOut)
        {
            return (false, ["This account has been locked due to too many failed login attempts. Please try again later."]);
        }
        else if (result.IsNotAllowed)
        {
            return (false, ["This account is not allowed to login. Please contact support."]);
        }
        else if (result.RequiresTwoFactor)
        {
            return (false, ["Two factor authentication is required but not supported by this application."]);
        }
        else
        {
            // This is typically a wrong password
            return (false, ["The password you entered is incorrect. Please try again."]);
        }
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
        await this.signInManager.SignOutAsync();
    }
}