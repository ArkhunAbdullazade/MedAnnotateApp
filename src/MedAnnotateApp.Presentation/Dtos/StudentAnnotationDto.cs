using System.Collections.Generic;

namespace MedAnnotateApp.Presentation.Dtos
{
    public class StudentAnnotationDto
    {
        // Basic metadata from the original MedData
        public int Id { get; set; }
        public string? ImageUrl { get; set; }
        public string? ImageDescription { get; set; }
        
        // Demographics data
        public string? Sex { get; set; }
        public string? Age { get; set; }
        public string? BodyRegion { get; set; }
        public string? Diagnosis { get; set; }
        public string? TreatmentName { get; set; }
        public string? Speciality { get; set; }
        public string? Modality { get; set; }
        
        // Individual annotation data
        public string? Coordinates { get; set; }
        public string? TextualAnnotation { get; set; }
    }

    public class StudentAnnotationList
    {
        public IEnumerable<StudentAnnotationDto>? Annotations { get; set; }
    }
} 