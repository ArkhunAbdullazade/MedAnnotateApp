using System.ComponentModel.DataAnnotations;

namespace MedAnnotateApp.Presentation.Dtos;
public class SignupDto
{
    [Required(ErrorMessage = "Email cannot be empty"), EmailAddress]
    public string? Email { get; set; }
    [Required(ErrorMessage = "Password cannot be empty"), DataType(DataType.Password)]
    public string? Password { get; set; }
    [DataType(DataType.Password), Compare("Password")]
    public string? ConfirmPassword { get; set; }
    [Required(ErrorMessage = "User Name cannot be empty")]
    public string? UserName { get; set; }
    [Required]
    public string? FullName { get; set; }
    [Required]
    public string? University { get; set; } 
    [Required]   
    public string? Position { get; set; }
    [Required]
    public string? Speciality { get; set; }
    [Required]
    public int ClinicalExperience { get; set; }
}