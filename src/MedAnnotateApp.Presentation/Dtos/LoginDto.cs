using System.ComponentModel.DataAnnotations;
using MedAnnotateApp.Presentation.Attributes;

namespace MedAnnotateApp.Presentation.Dtos;
public class LoginDto
{
    [Required(ErrorMessage = "Email address is required"), 
    EmailAddress(ErrorMessage = "Please enter a valid email address")]
    public string? Email { get; set; }
    
    [Required(ErrorMessage = "Password is required"), 
     DataType(DataType.Password)]
    public string? Password { get; set; }
}