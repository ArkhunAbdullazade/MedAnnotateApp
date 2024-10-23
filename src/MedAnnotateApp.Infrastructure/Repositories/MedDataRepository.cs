using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace MedAnnotateApp.Infrastructure.Repositories;
public class MedDataRepository : IMedDataRepository
{
    private readonly MedDataDbContext context;

    public MedDataRepository(MedDataDbContext context)
    {
        this.context = context;
    }

    public async Task<MedData?> GetNthMedDataBySpecialityAsync(string speciality, int n = 1)
    {
        return await context.MedDatas
            .Where(md => md.Speciality!.ToLower() == speciality)
            .ElementAtOrDefaultAsync(n);
    }

    public async Task<IEnumerable<MedData>> GetAllMedDataBySpecialityAsync(string speciality, int page = 1)
    {
        return await context.MedDatas
            .Where(md => md.Speciality!.ToLower() == speciality)
            .Skip((page-1)*20)
            .Take(20)
            .ToListAsync();
    }

    public async Task<IEnumerable<string?>> GetKeywordsByMedDataIdAsync(int id)
    {
        return await context.MedDataKeywords
            .Where(mdk => mdk.MedDataId == id)
            .Select(mdk => mdk.Keyword)
            .ToListAsync();
    }
}