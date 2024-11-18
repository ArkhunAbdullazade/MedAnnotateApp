using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Repositories;
public interface IMedDataRepository
{
    public Task<MedData?> GetNthMedDataBySpecialityAndPositionAsync(string speciality, string position, string userId);
    public Task<IEnumerable<string?>> GetKeywordsByMedDataIdAsync(int id);
    public Task<bool> UpdateIsAnnotated(int medDataId);
    public Task<bool> UpdateLock(int medDataId);
}