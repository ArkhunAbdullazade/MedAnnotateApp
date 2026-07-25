using System.ComponentModel.DataAnnotations;

namespace MedAnnotateApp.Presentation.Dtos;

public class AnnotatedMedDataDto
{
    [Range(1, int.MaxValue, ErrorMessage = "A valid medical data id is required")]
    public int Id { get; set; }

    public string? ImageUrl { get; set; }
    public string? ImageDescription { get; set; }
    public string? Sex { get; set; }
    public string? Age { get; set; }
    public string? SkinTone { get; set; }
    public string? BodyRegion { get; set; }
    public string? Diagnosis { get; set; }
    public string? TreatmentName { get; set; }
    public string? Speciality { get; set; }
    public string? Modality { get; set; }
    public string? BoxCoordinates { get; set; }
    public string? ExtractedKeyword { get; set; }
    public string? PressedButton { get; set; }
    public string? Timestamps { get; set; }
    public string? Comment { get; set; }
    public string? KeywordStates { get; set; }
}
