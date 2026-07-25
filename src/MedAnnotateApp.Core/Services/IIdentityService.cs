using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Services;

public interface IIdentityService
{
    Task<(bool Succeeded, IEnumerable<string>? Errors)> LoginAsync(string? email, string? password);
    Task<(bool Succeeded, IEnumerable<string>? Errors)> SignupAsync(User user, string? password, string? confirmationUrl);
    Task<bool> ConfirmEmailAsync(string? userId, string? token);
    Task SignoutAsync();
}
