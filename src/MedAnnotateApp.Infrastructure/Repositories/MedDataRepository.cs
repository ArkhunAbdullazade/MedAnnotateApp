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
        MedData? medData = null;

        var md = await context.MedDatas.FirstOrDefaultAsync(md => !md.IsAnnotated && md.LockedByUserId == userId);

        if (md is not null) return md;

        var totalMedDataCount = context.MedDatas.Count();
        var annotatedMedDataCount = context.MedDatas.Count(md => md.IsAnnotated);

        if (annotatedMedDataCount != totalMedDataCount && position.ToLower() == "clinician")
        {
            // if () {
            medData = await context.MedDatas
                .Where(md => !md.IsAnnotated && (md.LockedByUserId == null) && (md.Speciality!.ToLower() == speciality))
                .OrderBy(md => md.Id)
                .FirstOrDefaultAsync();
            // }
            // else {
            //     medData = await context.MedDatas
            //         .Where(md => md.IsAnnotated && (md.LockedByUserId == null) && (md.Speciality!.ToLower() == speciality))
            //         .OrderBy(m => m.Id)
            //         .FirstOrDefaultAsync();
            // }
        }
        // else
        // {
        //     medData = await context.MedDatas
        //             .Where(md => !md.IsThirdStageAnnotated && (md.LockedByUserId == null) && (md.Speciality!.ToLower() == speciality))
        //             .OrderBy(md => md.Id)
        //             .FirstOrDefaultAsync();
        // }

        if (medData != null)
        {
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

        // var totalMedDataCount = context.MedDatas.Count();
        // var annotatedMedDataCount = context.MedDatas.Count(md => md.IsAnnotated);

        // if (totalMedDataCount == annotatedMedDataCount) medData!.IsThirdStageAnnotated = true;
        // else medData!.IsAnnotated = true;

        medData!.IsAnnotated = true;

        medData.LockedByUserId = null;

        context.MedDatas.Update(medData);
        await context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> UpdateLock(int medDataId)
    {
        var medData = await context.MedDatas.FindAsync(medDataId);

        if (medData == null) return false;

        medData.LockedByUserId = null;

        context.MedDatas.Update(medData);
        await context.SaveChangesAsync();

        return true;
    }
}