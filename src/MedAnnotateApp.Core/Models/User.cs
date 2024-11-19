using Microsoft.AspNetCore.Identity;

namespace MedAnnotateApp.Core.Models;
public class User : IdentityUser
{
    public string? FullName { get; set; }
    public string? University { get; set; }    
    public string? Position { get; set; }
    public string? Speciality { get; set; }
    public int ClinicalExperience { get; set; }
    public string? OrcidId { get; set; }
}