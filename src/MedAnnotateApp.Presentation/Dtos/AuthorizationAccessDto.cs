using System.ComponentModel.DataAnnotations;

namespace MedAnnotateApp.Presentation.Dtos;
public class AuthorizationAccessDto
{
    [Required(ErrorMessage = "Password cannot be empty")]
    [DataType(DataType.Password)]
    public string? Password { get; set; }
}