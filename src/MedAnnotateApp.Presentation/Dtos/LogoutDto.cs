namespace MedAnnotateApp.Presentation.Dtos;
public class LogoutDto
{
    public bool IsAnnotationFinished { get; set; }
    public bool IsAnnotationStarted { get; set; }
    public int? MedDataId { get; set; }
}