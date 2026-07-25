using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Infrastructure.Data;

namespace MedAnnotateApp.Infrastructure.Repositories;

public class AnnotatedMedDataRepository : IAnnotatedMedDataRepository
{
    private readonly MedDataDbContext context;

    public AnnotatedMedDataRepository(MedDataDbContext context)
    {
        this.context = context;
    }

    public async Task<bool> CreateAllAsync(IEnumerable<AnnotatedMedData> annotatedMedDatas)
    {
        await context.AnnotatedMedDatas.AddRangeAsync(annotatedMedDatas);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CreateAsync(AnnotatedMedData annotatedMedData)
    {
        await context.AnnotatedMedDatas.AddAsync(annotatedMedData);
        await context.SaveChangesAsync();
        return true;
    }
}
