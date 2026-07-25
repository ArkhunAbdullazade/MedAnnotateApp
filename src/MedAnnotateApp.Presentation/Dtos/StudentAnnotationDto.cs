using System.ComponentModel.DataAnnotations;

namespace MedAnnotateApp.Presentation.Dtos;

public class StudentAnnotationDto
{
    [Range(1, int.MaxValue, ErrorMessage = "A valid medical data id is required")]
    public int Id { get; set; }

    public string? ImageUrl { get; set; }
    public string? ImageDescription { get; set; }
    public string? Sex { get; set; }
    public string? Age { get; set; }
    public string? BodyRegion { get; set; }
    public string? Diagnosis { get; set; }
    public string? TreatmentName { get; set; }
    public string? Speciality { get; set; }
    public string? Modality { get; set; }
    public string? Coordinates { get; set; }
    public string? TextualAnnotation { get; set; }
}

public class StudentAnnotationList
{
    public IEnumerable<StudentAnnotationDto>? Annotations { get; set; }
}
