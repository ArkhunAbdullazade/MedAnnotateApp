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

    public async Task<(MedData? MedData, string Counter)> GetNthMedDataBySpecialityAndPositionAsync(
        string? speciality,
        string? position,
        string? bodyRegion,
        string? imageModality,
        string userId)
    {
        var isStudent = string.Equals(position, "medical student", StringComparison.OrdinalIgnoreCase);
        var totalMedDataCount = await context.MedDatas.CountAsync();
        var annotatedMedDataCount = isStudent
            ? await context.MedDatas.CountAsync(medData => medData.IsAnnotatedByStudent)
            : await context.MedDatas.CountAsync(medData => medData.IsAnnotated);
        var counter = $"{annotatedMedDataCount}/{totalMedDataCount}";

        var lockedMedData = isStudent
            ? await context.MedDatas.FirstOrDefaultAsync(medData => !medData.IsAnnotatedByStudent && medData.LockedByStudentUserId == userId)
            : await context.MedDatas.FirstOrDefaultAsync(medData => !medData.IsAnnotated && medData.LockedByUserId == userId);

        if (lockedMedData != null)
        {
            return (lockedMedData, counter);
        }

        if (annotatedMedDataCount >= totalMedDataCount)
        {
            return (null, counter);
        }

        var userSpecialties = SplitFilters(speciality);
        var userBodyRegions = SplitFilters(bodyRegion);
        var userImageModalities = SplitFilters(imageModality);

        var query = context.MedDatas.Where(medData => isStudent ? !medData.IsAnnotatedByStudent : !medData.IsAnnotated);

        if (userSpecialties.Count > 0)
        {
            query = query.Where(medData => medData.Speciality != null && userSpecialties.Contains(medData.Speciality.ToLower()));
        }

        query = isStudent
            ? query.Where(medData => medData.LockedByStudentUserId == null)
            : query.Where(medData => medData.LockedByUserId == null);

        if (userBodyRegions.Count > 0)
        {
            query = query.Where(medData => medData.BodyRegion != null && userBodyRegions.Contains(medData.BodyRegion.ToLower()));
        }

        if (userImageModalities.Count > 0)
        {
            query = query.Where(medData => medData.Modality != null && userImageModalities.Contains(medData.Modality.ToLower()));
        }

        var nextMedData = await query.OrderBy(medData => medData.Id).FirstOrDefaultAsync();
        if (nextMedData == null)
        {
            return (null, counter);
        }

        if (isStudent)
        {
            nextMedData.LockedByStudentUserId = userId;
        }
        else
        {
            nextMedData.LockedByUserId = userId;
        }

        await context.SaveChangesAsync();

        return (nextMedData, counter);
    }

    public async Task<IEnumerable<string?>> GetKeywordsByMedDataIdAsync(int id)
    {
        return await context.MedDataKeywords
            .Where(medDataKeyword => medDataKeyword.MedDataId == id)
            .Select(medDataKeyword => medDataKeyword.Keyword)
            .ToListAsync();
    }

    public async Task<bool> UpdateIsAnnotated(int medDataId, bool isAnnotatedByStudent)
    {
        var medData = await context.MedDatas.FindAsync(medDataId);
        if (medData == null)
        {
            return false;
        }

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

        await context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> UpdateLock(int medDataId, string keywordStates, bool isAnnotationStarted, bool isStudent)
    {
        var medData = await context.MedDatas.FindAsync(medDataId);
        if (medData == null)
        {
            return false;
        }

        if (isStudent)
        {
            medData.LockedByStudentUserId = null;
        }
        else if (isAnnotationStarted)
        {
            medData.KeywordStates = keywordStates;
        }
        else
        {
            medData.KeywordStates = null;
            medData.LockedByUserId = null;
        }

        await context.SaveChangesAsync();

        return true;
    }

    private static List<string> SplitFilters(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? []
            : value
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(filter => filter.ToLower())
                .ToList();
    }
}
