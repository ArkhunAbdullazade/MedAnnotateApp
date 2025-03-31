using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace MedAnnotateApp.Infrastructure.Repositories;

public class AnnotatedByStudentsMedDataRepository : IAnnotatedByStudentsMedDataRepository
{
    private readonly MedDataDbContext _context;

    public AnnotatedByStudentsMedDataRepository(MedDataDbContext context)
    {
        _context = context;
    }

    public async Task<bool> CreateAsync(AnnotatedByStudentsMedData entity)
    {
        try
        {
            await _context.AnnotatedByStudentsMedDatas.AddAsync(entity);
            await _context.SaveChangesAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> CreateAllAsync(IEnumerable<AnnotatedByStudentsMedData> entities)
    {
        try
        {
            await _context.AnnotatedByStudentsMedDatas.AddRangeAsync(entities);
            await _context.SaveChangesAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<IEnumerable<AnnotatedByStudentsMedData>> GetAllAsync()
    {
        return await _context.AnnotatedByStudentsMedDatas.ToListAsync();
    }

    public async Task<AnnotatedByStudentsMedData?> GetByIdAsync(int id)
    {
        return await _context.AnnotatedByStudentsMedDatas.FindAsync(id);
    }

    public async Task<bool> UpdateAsync(AnnotatedByStudentsMedData entity)
    {
        try
        {
            _context.AnnotatedByStudentsMedDatas.Update(entity);
            await _context.SaveChangesAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        try
        {
            var entity = await GetByIdAsync(id);
            if (entity == null) return false;
            
            _context.AnnotatedByStudentsMedDatas.Remove(entity);
            await _context.SaveChangesAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }
}