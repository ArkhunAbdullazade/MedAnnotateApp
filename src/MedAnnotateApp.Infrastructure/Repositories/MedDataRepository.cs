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
        bool IsStudent = position.ToLower() == "medical student";

        // Get counting stats for progress indicator
        var totalMedDataCount = await context.MedDatas.CountAsync();
        var annotatedMedDataCount = IsStudent ? await context.MedDatas.CountAsync(md => md.IsAnnotatedByStudent) : await context.MedDatas.CountAsync(md => md.IsAnnotated);
        var counter = $"{annotatedMedDataCount}/{totalMedDataCount}";

        MedData? lockedMedData = null;

        if (IsStudent)
        {
            lockedMedData = await context.MedDatas
                .FirstOrDefaultAsync(md => !md.IsAnnotatedByStudent && md.LockedByStudentUserId == userId);
        }
        else
        {
            lockedMedData = await context.MedDatas
                .FirstOrDefaultAsync(md => !md.IsAnnotated && md.LockedByUserId == userId);
        }

        if (lockedMedData != null)
        {
            return (lockedMedData, counter);
        }

        // If we have no more data to annotate, return null
        if (annotatedMedDataCount >= totalMedDataCount)
        {
            return (null, counter);
        }

        // Parse body regions and modalities (assumes comma-separated strings)
        var userBodyRegions = !string.IsNullOrEmpty(bodyRegion)
            ? bodyRegion.ToLower().Split(',').Select(br => br.Trim()).ToList()
            : new List<string>();

        var userImageModalities = !string.IsNullOrEmpty(imageModality)
            ? imageModality.ToLower().Split(',').Select(im => im.Trim()).ToList()
            : new List<string>();

        // Prepare the query based on position type
        var query = context.MedDatas
            .Where(md => IsStudent ? !md.IsAnnotatedByStudent : !md.IsAnnotated);

        // Add speciality filter
        query = query.Where(md => md.Speciality != null && md.Speciality.ToLower() == speciality.ToLower());

        // For non-students, also check that it's not locked by another user
        if (!IsStudent)
        {
            query = query.Where(md => md.LockedByUserId == null);
        }
        else
        {
            query = query.Where(md => md.LockedByStudentUserId == null);
        }

        // Apply body region filter if specified
        if (userBodyRegions.Any())
        {
            query = query.Where(md => md.BodyRegion != null &&
                userBodyRegions.Contains(md.BodyRegion.ToLower()));
        }

        // Apply image modality filter if specified
        if (userImageModalities.Any())
        {
            query = query.Where(md => md.Modality != null &&
                userImageModalities.Contains(md.Modality.ToLower()));
        }

        // Get the first available MedData
        var medData = await query.OrderBy(md => md.Id).FirstOrDefaultAsync();

        // If found, lock it for this user (except for students who may see locked data)
        if (medData != null && !IsStudent)
        {
            medData.LockedByUserId = userId;
            await context.SaveChangesAsync();
        }
        else if (medData != null && IsStudent)
        {
            medData.LockedByStudentUserId = userId;
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

    public async Task<bool> UpdateIsAnnotated(int medDataId, bool isAnnotatedByStudent)
    {
        var medData = await context.MedDatas.FindAsync(medDataId);

        if (medData == null) return false;

        if (isAnnotatedByStudent)
        {
            medData.IsAnnotatedByStudent = true;
            medData.LockedByStudentUserId = null;
        }
        else
        {
            medData.IsAnnotated = true;
            medData.LockedByUserId = null;
            medData.KeywordStates = null;
        }


        context.MedDatas.Update(medData);
        await context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> UpdateLock(int medDataId, string keywordStates, bool isAnnotationStarted, bool isStudent)
    {
        var medData = await context.MedDatas.FindAsync(medDataId);

        if (medData == null) return false;

        if (isStudent)
        {
            medData.LockedByStudentUserId = null;
        }
        else
        {
            if (isAnnotationStarted)
            {
                // Save the current state of keywords
                medData.KeywordStates = keywordStates;
            }
            else
            {
                // Release the lock entirely
                medData.KeywordStates = null;
                medData.LockedByUserId = null;
            }
        }


        context.MedDatas.Update(medData);
        await context.SaveChangesAsync();

        return true;
    }
}