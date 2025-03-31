using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace MedAnnotateApp.Presentation.Attributes;

public class RestrictEmailDomainAttribute : ValidationAttribute
{
    // These are allowed domains, not restricted ones
    private static readonly string[] AllowedDomains = { "stanford.edu", "mountsinai.org" };
    
    public RestrictEmailDomainAttribute()
    {
        // Set default error message that will appear in the validation summary
        ErrorMessage = $"Only institutional emails are allowed. Accepted domains: {string.Join(", ", AllowedDomains)}";
    }
    
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is string email)
        {
            // Skip validation if email is empty (another validator will catch that)
            if (string.IsNullOrWhiteSpace(email))
                return ValidationResult.Success;
                
            var parts = email.Split('@');
            if (parts.Length != 2)
            {
                return new ValidationResult("Invalid email format. Please enter a valid email address.");
            }
            
            var domain = parts[1].ToLower(); // Convert domain to lowercase for case-insensitive comparison
            if (!AllowedDomains.Contains(domain))
            {
                // Use the ErrorMessage property to ensure it shows in validation summary
                return new ValidationResult(ErrorMessage);
            }
        }
        return ValidationResult.Success;
    }
}
