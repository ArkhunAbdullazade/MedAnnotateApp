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

    public async Task<MedData?> GetNthMedDataBySpecialityAndPositionAsync(string speciality, string position, string userId)
    {
        MedData? medData;

        var mds = context.MedDatas.Where(md => !md.IsAnnotated && md.LockedByUserId == userId);

        if((await mds.CountAsync()) > 0) return await mds.FirstOrDefaultAsync();

        if (position.ToLower() == "clinician") {
            medData = await context.MedDatas
                .Where(md => !md.IsAnnotated && (md.LockedByUserId == null) && (md.Speciality!.ToLower() == speciality))
                .OrderBy(md => md.Id)
                .FirstOrDefaultAsync();
        }
        else {
            medData = await context.MedDatas
                .Where(md => md.IsAnnotated && md.LockedByUserId == null && (md.Speciality!.ToLower() == speciality))
                .OrderBy(m => m.Id)
                .FirstOrDefaultAsync();
        }

        if (medData != null) {
            medData.LockedByUserId = userId;
            await context.SaveChangesAsync();
        }

        return medData;
    }


    public async Task<IEnumerable<string?>> GetKeywordsByMedDataIdAsync(int id)
    {
        return await context.MedDataKeywords
            .Where(mdk => mdk.MedDataId == id)
            .Select(mdk => mdk.Keyword)
            .ToListAsync();
    }

    public async Task<bool> UpdateIsAnnotated(int medDataId)
    {
        var medData = await context.MedDatas.FindAsync(medDataId);

        if (medData == null) return false;

        medData!.IsAnnotated = true;
        medData.LockedByUserId = null;

        context.MedDatas.Update(medData); 
        await context.SaveChangesAsync(); 

        return true;
    }

    public async Task<IEnumerable<MedData>> GetAllMedDataBySpecialityAsync(string speciality, int page = 1)
    {
        return await context.MedDatas
            .Where(md => md.Speciality!.ToLower() == speciality)
            .Skip((page-1)*20)
            .Take(20)
            .ToListAsync();
    }
}