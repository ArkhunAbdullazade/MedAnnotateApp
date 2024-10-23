using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Repositories;
public interface IMedDataRepository
{
    public Task<MedData?> GetNthMedDataBySpecialityAsync(string speciality, int n = 1);
    public Task<IEnumerable<MedData>> GetAllMedDataBySpecialityAsync(string speciality, int page = 1);
    public Task<IEnumerable<string?>> GetKeywordsByMedDataIdAsync(int id);
}