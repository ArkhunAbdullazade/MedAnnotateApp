using System.ComponentModel.DataAnnotations;
using MedAnnotateApp.Presentation.Attributes;

namespace MedAnnotateApp.Presentation.Dtos;

public class SignupDto
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    [RestrictEmailDomain]
    public string? Email { get; set; }

    [Required(ErrorMessage = "Full name is required")]
    public string? FullName { get; set; }

    [Required(ErrorMessage = "Password is required")]
    [DataType(DataType.Password)]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters long")]
    public string? Password { get; set; }

    [Required(ErrorMessage = "Confirm password is required")]
    [DataType(DataType.Password)]
    [Compare("Password", ErrorMessage = "The password and confirmation password do not match")]
    public string? ConfirmPassword { get; set; }

    [Required(ErrorMessage = "Position is required")]
    public string? Position { get; set; }

    [Required(ErrorMessage = "At least one specialty is required")]
    public string[]? Speciality { get; set; }

    [Required(ErrorMessage = "University is required")]
    public string? University { get; set; }

    [Required(ErrorMessage = "Clinical experience is required")]
    [Range(0, 80, ErrorMessage = "Clinical experience must be between 0 and 80 years")]
    public int? ClinicalExperience { get; set; }

    [Required(ErrorMessage = "At least one body region is required")]
    public string[]? BodyRegion { get; set; }

    [Required(ErrorMessage = "At least one image modality is required")]
    public string[]? ImageModality { get; set; }

    public string? OrcidId { get; set; }
}
