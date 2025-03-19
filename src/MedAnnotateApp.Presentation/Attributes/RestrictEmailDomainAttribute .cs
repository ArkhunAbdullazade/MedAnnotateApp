using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace MedAnnotateApp.Presentation.Attributes;

public class RestrictEmailDomainAttribute : ValidationAttribute
{
    private static readonly string[] RestrictedDomains = { "stanford.edu", "mountsinai.org" };
    
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is string email)
        {
            var domain = email.Split('@').LastOrDefault();
            if (domain != null && RestrictedDomains.Contains(domain.ToLower()))
            {
                return new ValidationResult($"Emails from {domain} are not allowed.");
            }
        }
        return ValidationResult.Success;
    }
}
