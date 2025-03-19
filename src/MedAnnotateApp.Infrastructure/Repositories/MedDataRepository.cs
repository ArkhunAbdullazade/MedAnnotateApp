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

    public async Task<(MedData?, string)> GetNthMedDataBySpecialityAndPositionAsync(string speciality, string position, string bodyRegion, string imageModality, string userId)
    {
        MedData? medData = null;

        var md = await context.MedDatas.FirstOrDefaultAsync(md => !md.IsAnnotated && md.LockedByUserId == userId);

        var totalMedDataCount = context.MedDatas.Count();
        var annotatedMedDataCount = context.MedDatas.Count(md => md.IsAnnotated);
        var counter = $"{annotatedMedDataCount}/{totalMedDataCount}";

        if (md is not null) return (md, counter);

        if (annotatedMedDataCount != totalMedDataCount && position.ToLower() != "medical student")
        {   
            // && (md.BodyRegion!.ToLower() == bodyRegion) && (md.Modality!.ToLower() == imageModality)
            medData = await context.MedDatas
                .Where(md => !md.IsAnnotated && (md.LockedByUserId == null) && (md.Speciality!.ToLower() == speciality))
                .OrderBy(md => md.Id)
                .FirstOrDefaultAsync();

        }

        if (medData != null)
        {
            medData.LockedByUserId = userId;
            await context.SaveChangesAsync();
        }

        return (medData, counter);
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

        medData!.IsAnnotated = true;
        medData.LockedByUserId = null;
        medData.KeywordStates = null;

        context.MedDatas.Update(medData);
        await context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> UpdateLock(int medDataId, string keywordStates, bool isAnnotationStarted)
    {
        var medData = await context.MedDatas.FindAsync(medDataId);

        if (medData == null) return false;

        if (isAnnotationStarted)
        {
            medData.KeywordStates = keywordStates;
        }
        else
        {
            medData.KeywordStates = null;
            medData.LockedByUserId = null;
        }
        context.MedDatas.Update(medData);
        await context.SaveChangesAsync();

        return true;
    }
}