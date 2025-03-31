using System.ComponentModel.DataAnnotations;
using MedAnnotateApp.Presentation.Attributes;

namespace MedAnnotateApp.Presentation.Dtos;
public class SignupDto
{
    [Required(ErrorMessage = "Email address is required"), 
     EmailAddress(ErrorMessage = "Please enter a valid email address")]
    [RestrictEmailDomain(ErrorMessage = "Only institutional emails are allowed (stanford.edu or mountsinai.org)")]
    public string? Email { get; set; }
    [Required(ErrorMessage = "Password is required"), 
     DataType(DataType.Password)]
    public string? Password { get; set; }
    [Required(ErrorMessage = "Please confirm your password"), 
     DataType(DataType.Password), 
     Compare("Password", ErrorMessage = "Passwords do not match")]
    public string? ConfirmPassword { get; set; }
    [Required(ErrorMessage = "Full name is required")]
    public string? FullName { get; set; }
    [Required(ErrorMessage = "University is required")]
    public string? University { get; set; } 
    [Required(ErrorMessage = "Position is required")]
    public string? Position { get; set; }
    [Required(ErrorMessage = "Speciality is required")]
    public string? Speciality { get; set; }
    [Required(ErrorMessage = "Please select at least one body region")]
    public string[]? BodyRegion { get; set; }
    [Required(ErrorMessage = "Please select at least one image modality")]
    public string[]? ImageModality { get; set; }
    [Required(ErrorMessage = "Clinical experience is required")]
    public int ClinicalExperience { get; set; }
    public string? OrcidId { get; set; }
}