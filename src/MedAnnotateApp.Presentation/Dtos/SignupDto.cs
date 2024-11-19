using System.ComponentModel.DataAnnotations;

namespace MedAnnotateApp.Presentation.Dtos;
public class SignupDto
{
    [Required(ErrorMessage = "Email cannot be empty"), EmailAddress]
    public string? Email { get; set; }
    [Required(ErrorMessage = "Password cannot be empty"), DataType(DataType.Password)]
    public string? Password { get; set; }
    [Required(ErrorMessage = "Confirmation of the Password cannot be empty"), DataType(DataType.Password), Compare("Password", ErrorMessage = "Passwords do not match.")]
    public string? ConfirmPassword { get; set; }
    [Required(ErrorMessage = "Full Name cannot be empty")]
    public string? FullName { get; set; }
    [Required(ErrorMessage = "University cannot be empty")]
    public string? University { get; set; } 
    [Required(ErrorMessage = "Position cannot be empty")]
    public string? Position { get; set; }
    [Required(ErrorMessage = "Speciality cannot be empty")]
    public string? Speciality { get; set; }
    [Required(ErrorMessage = "Clinical Experience cannot be empty")]
    public int ClinicalExperience { get; set; }
    public string? OrcidId { get; set; }
}