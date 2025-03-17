using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Repositories;
public interface IAnnotatedMedDataRepository
{
    public Task<bool> CreateAsync(AnnotatedMedData annotatedMedData);
    public Task<bool> CreateAllAsync(IEnumerable<AnnotatedMedData> annotatedMedDatas);
}