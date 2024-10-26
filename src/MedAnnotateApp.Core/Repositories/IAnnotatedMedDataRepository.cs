using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Repositories;
public interface IAnnotatedMedDataRepository
{
    public Task<bool> CreateAsync(AnnotatedMedData annotatedMedData);
}