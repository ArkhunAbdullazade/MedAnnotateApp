namespace MedAnnotateApp.Core.Models;

public class CurrentCounter
{
    public int Id { get; set; }
    public string? UserId { get; set; }
    public string? Speciality { get; set; }
    public int CurrentValue { get; set; }
    public bool IsBeingAnnotated { get; set; }
}