using System.ComponentModel.DataAnnotations;

namespace MedAnnotateApp.Presentation.Attributes;

public class RestrictEmailDomainAttribute : ValidationAttribute
{
    private static readonly string[] AllowedDomains = ["stanford.edu", "mountsinai.org"];

    public RestrictEmailDomainAttribute()
    {
        ErrorMessage = $"Only institutional emails are allowed. Accepted domains: {string.Join(", ", AllowedDomains)}";
    }

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is not string email || string.IsNullOrWhiteSpace(email))
        {
            return ValidationResult.Success;
        }

        var parts = email.Split('@', StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || string.IsNullOrWhiteSpace(parts[0]) || string.IsNullOrWhiteSpace(parts[1]))
        {
            return new ValidationResult("Invalid email format. Please enter a valid email address.");
        }

        return AllowedDomains.Contains(parts[1], StringComparer.OrdinalIgnoreCase)
            ? ValidationResult.Success
            : new ValidationResult(ErrorMessage);
    }
}
