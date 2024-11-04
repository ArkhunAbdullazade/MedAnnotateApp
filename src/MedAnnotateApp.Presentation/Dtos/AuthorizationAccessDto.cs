using System.ComponentModel.DataAnnotations;

namespace MedAnnotateApp.Presentation.Dtos;
public class AuthorizationAccessDto
{
    [Required(ErrorMessage = "Password cannot be empty")]
    public string? Password { get; set; }
}