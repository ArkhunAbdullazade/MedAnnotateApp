using System.ComponentModel.DataAnnotations;

namespace MedAnnotateApp.Presentation.Dtos;

public class SignupDto : ImageFiltersDto
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
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
    [RegularExpression("^(specialist|general practitioner|resident/assistant|medical student)$", ErrorMessage = "Choose a position from the list.")]
    public string? Position { get; set; }

    [Required(ErrorMessage = "Enter your university or institution.")]
    public string? University { get; set; }

    [Required(ErrorMessage = "Clinical experience is required")]
    [Range(0, 80, ErrorMessage = "Clinical experience must be between 0 and 80 years")]
    public int? ClinicalExperience { get; set; }

    public string? OrcidId { get; set; }
}
