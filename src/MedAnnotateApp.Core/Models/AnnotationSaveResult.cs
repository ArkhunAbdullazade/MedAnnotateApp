namespace MedAnnotateApp.Core.Models;

public sealed record AnnotationSaveResult(bool Success, string? Message = null, bool Conflict = false);
