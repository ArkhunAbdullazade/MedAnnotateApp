using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Services;
using Microsoft.AspNetCore.Identity;

namespace MedAnnotateApp.Infrastructure.Services;

public class IdentityService : IIdentityService
{
    private readonly UserManager<User> userManager;
    private readonly SignInManager<User> signInManager;

    public IdentityService(UserManager<User> userManager, SignInManager<User> signInManager)
    {
        this.userManager = userManager;
        this.signInManager = signInManager;
    }

    public async Task<(bool Succeeded, IEnumerable<string>? Errors)> SignupAsync(User user, string? password, string? confirmationUrl)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            return (false, ["Password is required."]);
        }

        var result = await userManager.CreateAsync(user, password);

        return result.Succeeded
            ? (true, null)
            : (false, result.Errors.Select(error => error.Description).ToArray());
    }

    public async Task<(bool Succeeded, IEnumerable<string>? Errors)> LoginAsync(string? email, string? password)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return (false, ["Email address is required."]);
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            return (false, ["Password is required."]);
        }

        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            return (false, ["The email address you entered does not exist in our system."]);
        }

        var result = await signInManager.PasswordSignInAsync(user, password, isPersistent: false, lockoutOnFailure: false);

        if (result.Succeeded)
        {
            return (true, null);
        }

        if (result.IsLockedOut)
        {
            return (false, ["This account has been locked due to too many failed login attempts. Please try again later."]);
        }

        if (result.IsNotAllowed)
        {
            return (false, ["This account is not allowed to login. Please contact support."]);
        }

        if (result.RequiresTwoFactor)
        {
            return (false, ["Two factor authentication is required but is not supported by this application."]);
        }

        return (false, ["The password you entered is incorrect. Please try again."]);
    }

    public async Task<bool> ConfirmEmailAsync(string? userId, string? token)
    {
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            return false;
        }

        var result = await userManager.ConfirmEmailAsync(user, token);

        return result.Succeeded;
    }

    public async Task SignoutAsync()
    {
        await signInManager.SignOutAsync();
    }
}
