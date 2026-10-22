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

    public async Task<(bool Succeeded, IEnumerable<string>? Errors)> SignupAsync(User user, string? password, string roleName)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            return (false, ["Password is required."]);
        }

        if (roleName is not ("Professional" or "Medical_Student"))
        {
            return (false, ["Choose a valid research participant position."]);
        }

        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            return (false, result.Errors.Select(error => error.Description).ToArray());
        }

        var roleResult = await userManager.AddToRoleAsync(user, roleName);
        if (roleResult.Succeeded)
        {
            return (true, null);
        }

        // Remove only the just-created account if assigning its research role fails.
        var cleanup = await userManager.DeleteAsync(user);
        return (false, [cleanup.Succeeded
            ? "Your account could not be created. Please try again or contact the researcher."
            : "Your account needs attention before you can sign in. Please contact the researcher."]);
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
            return (false, ["Email or password is incorrect. Please try again."]);
        }

        var result = await signInManager.PasswordSignInAsync(user, password, isPersistent: false, lockoutOnFailure: true);

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

        return (false, ["Email or password is incorrect. Please try again."]);
    }

    public async Task SignoutAsync()
    {
        await signInManager.SignOutAsync();
    }
}
