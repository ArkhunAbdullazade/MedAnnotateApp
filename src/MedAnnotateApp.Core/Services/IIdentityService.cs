using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Services;
public interface IIdentityService
{
    // public Task<User> GetUserByIdAsync(string id);
    public Task<(bool Succeeded, IEnumerable<string>? Errors)> LoginAsync(string? email, string? password);
    public Task<(bool Succeeded, IEnumerable<string>? Errors)> SignupAsync(User user, string? password, string? confirmationUrl);
    public Task<bool> ConfirmEmailAsync(string? userId, string? token);
    public Task SignoutAsync();
}