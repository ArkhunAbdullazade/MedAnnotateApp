using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Repositories;
public interface IMedDataRepository
{
    public Task<(MedData?, string)> GetNthMedDataBySpecialityAndPositionAsync(string speciality, string position, string bodyRegion, string imageModality, string userId);
    public Task<IEnumerable<string?>> GetKeywordsByMedDataIdAsync(int id);
    public Task<bool> UpdateIsAnnotated(int medDataId);
    public Task<bool> UpdateLock(int medDataId, string keywordStates, bool isAnnotationStarted);
}