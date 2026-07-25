using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Repositories;

public interface IMedDataRepository
{
    Task<(MedData? MedData, string Counter)> GetNthMedDataBySpecialityAndPositionAsync(
        string? speciality,
        string? position,
        string? bodyRegion,
        string? imageModality,
        string userId);

    Task<IEnumerable<string?>> GetKeywordsByMedDataIdAsync(int id);
    Task<bool> UpdateIsAnnotated(int medDataId, bool isAnnotatedByStudent);
    Task<bool> UpdateLock(int medDataId, string keywordStates, bool isAnnotationStarted, bool isStudent);
}
