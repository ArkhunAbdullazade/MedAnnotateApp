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

    public async Task<bool> CreateAsync(AnnotatedMedData annotatedMedData)
    {
        await this.context.AnnotatedMedDatas.AddAsync(annotatedMedData);
        await this.context.SaveChangesAsync();
        return true;
    }
}