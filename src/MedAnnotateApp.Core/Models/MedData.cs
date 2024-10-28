namespace MedAnnotateApp.Core.Models;
public class MedData
{
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
    public bool IsAnnotated { get; set; }
    public string? LockedByUserId  { get; set; }

    public ICollection<MedDataKeyword>? MedDataKeywords { get; set; }
}