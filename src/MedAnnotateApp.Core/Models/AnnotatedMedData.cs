namespace MedAnnotateApp.Core.Models;
public class AnnotatedMedData
{
    public int Id { get; set; }
    
    // MetaData
    public int MedDataId { get; set; }
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

    // AnnotationData
    public string? BoxCoordinates { get; set; }
    public string? ExtractedKeyword { get; set; }
    public string? PressedButton { get; set; }
    public string? Timestamps { get; set; }

    // UserData
    public string? Email { get; set; }
    public string? FullName { get; set; }
    public string? University { get; set; }    
    public string? Position { get; set; }
    public int ClinicalExperience { get; set; }
    public string? OrcidId { get; set; }
}