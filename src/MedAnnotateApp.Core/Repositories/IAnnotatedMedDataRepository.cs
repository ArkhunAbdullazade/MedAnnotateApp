using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Repositories;

public interface IAnnotatedMedDataRepository
{
    Task<bool> CreateAsync(AnnotatedMedData annotatedMedData);
    Task<bool> CreateAllAsync(IEnumerable<AnnotatedMedData> annotatedMedDatas);
}
