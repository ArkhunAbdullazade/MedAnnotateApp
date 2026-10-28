using System.Text.Json;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Infrastructure.Data;
using MedAnnotateApp.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace MedAnnotateApp.Infrastructure.Services.Admin;

/// <summary>
/// Lock releases from the admin panel and the sweeper. Each runs under the annotators' workflow lock for a few
/// milliseconds, so it can never interleave with a claim or save. Saved responses are never deleted: a released
/// image goes back into the pool and the next specialist answers every term themselves.
/// </summary>
public sealed class AssignmentAdminService
{
    private readonly MedDataDbContext context;

    public AssignmentAdminService(MedDataDbContext context) => this.context = context;

    public async Task<ReleaseResult> ReleaseAsync(int imageId, bool student, string expectedHolderId, string adminUserId, CancellationToken cancellationToken = default)
    {
        var results = await ReleaseManyAsync([(imageId, student, expectedHolderId)], adminUserId, cancellationToken);
        return results[0];
    }

    public async Task<IReadOnlyList<ReleaseResult>> ReleaseManyAsync(
        IReadOnlyList<(int ImageId, bool Student, string HolderId)> locks, string adminUserId, CancellationToken cancellationToken = default)
    {
        var results = new List<ReleaseResult>();
        await using var transaction = await MedDataRepository.BeginWorkflowAsync(context, cancellationToken);
        foreach (var (imageId, student, holderId) in locks)
        {
            var image = await context.MedDatas.FindAsync([imageId], cancellationToken);
            // The holder must still match what the admin saw, so a lock that changed hands is never released by mistake.
            if (image == null || (student ? image.LockedByStudentUserId : image.LockedByUserId) != holderId)
            {
                results.Add(new ReleaseResult(false, $"Image {imageId} is no longer locked by that person; nothing changed."));
                continue;
            }
            var kept = student ? 0 : await SavedResponsesAsync(image.Id, holderId, cancellationToken);
            var lockedAt = student ? image.StudentLockedAt : image.LockedAt;
            if (student) MedDataRepository.ClearStudentLock(image);
            else MedDataRepository.ClearProfessionalLock(image);
            context.AdminActions.Add(Audit(adminUserId, student ? "release-student-lock" : "release-specialist-lock", image.Id, holderId,
                new { keptResponses = kept, lockedAt }));
            results.Add(new ReleaseResult(true, kept > 0
                ? $"Released image {imageId}. {kept} saved answer(s) were kept and are marked as an incomplete set."
                : $"Released image {imageId}.", kept));
        }
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return results;
    }

    public async Task<int> ReleaseAllForUserAsync(string userId, string adminUserId, CancellationToken cancellationToken = default)
    {
        var locks = await context.MedDatas.AsNoTracking()
            .Where(image => image.LockedByUserId == userId || image.LockedByStudentUserId == userId)
            .Select(image => new { image.Id, Student = image.LockedByStudentUserId == userId }).ToListAsync(cancellationToken);
        if (locks.Count == 0) return 0;
        var results = await ReleaseManyAsync(locks.Select(item => (item.Id, item.Student, userId)).ToList(), adminUserId, cancellationToken);
        return results.Count(result => result.Released);
    }

    /// <summary>Releases locks with nothing saved whose holder has not opened the image within <paramref name="idle"/>.</summary>
    public async Task<int> ReleaseIdleEmptyLocksAsync(TimeSpan idle, DateTime now, CancellationToken cancellationToken = default)
    {
        var cutoff = now - idle;
        // Cheap check first, outside the workflow lock, so the sweeper normally never touches it.
        if (!await context.MedDatas.AnyAsync(image => (image.LockedByUserId != null && image.LockedAt < cutoff)
                || (image.LockedByStudentUserId != null && image.StudentLockedAt < cutoff), cancellationToken))
            return 0;

        await using var transaction = await MedDataRepository.BeginWorkflowAsync(context, cancellationToken);
        var candidates = await context.MedDatas.Where(image => (image.LockedByUserId != null && image.LockedAt < cutoff)
            || (image.LockedByStudentUserId != null && image.StudentLockedAt < cutoff)).ToListAsync(cancellationToken);
        var released = 0;
        foreach (var image in candidates)
        {
            // Students save everything at once, so a student lock is always empty; partial specialist work is only flagged.
            if (image.LockedByStudentUserId != null && image.StudentLockedAt < cutoff)
            {
                context.AdminActions.Add(Audit(null, "auto-release-student-lock", image.Id, image.LockedByStudentUserId, new { lockedAt = image.StudentLockedAt }));
                MedDataRepository.ClearStudentLock(image);
                released++;
            }
            if (image.LockedByUserId != null && image.LockedAt < cutoff
                && await SavedResponsesAsync(image.Id, image.LockedByUserId, cancellationToken) == 0)
            {
                context.AdminActions.Add(Audit(null, "auto-release-specialist-lock", image.Id, image.LockedByUserId, new { lockedAt = image.LockedAt }));
                MedDataRepository.ClearProfessionalLock(image);
                released++;
            }
        }
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return released;
    }

    private async Task<int> SavedResponsesAsync(int imageId, string holderId, CancellationToken cancellationToken)
    {
        var email = await context.Users.Where(user => user.Id == holderId).Select(user => user.Email).SingleOrDefaultAsync(cancellationToken);
        return email == null ? 0 : await context.AnnotatedMedDatas.CountAsync(answer => answer.MedDataId == imageId && answer.Email == email, cancellationToken);
    }

    private static AdminAction Audit(string? adminUserId, string action, int imageId, string? targetUserId, object details) => new()
    {
        At = DateTime.UtcNow, AdminUserId = adminUserId, Action = action, MedDataId = imageId, TargetUserId = targetUserId,
        Details = JsonSerializer.Serialize(details)
    };
}
