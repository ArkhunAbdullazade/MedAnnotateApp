namespace MedAnnotateApp.Core.Repositories;
public interface ICounterRepository
{
    public Task<int> GetCurrentCounterAsync(string userId, string specialty);
    public Task<bool> UpdateCurrentCounterByUserIdAsync(string userId, string specialty);
    public Task<bool> UpdateMaxCounterBySpecialityAsync(string userId, string specialty);
}