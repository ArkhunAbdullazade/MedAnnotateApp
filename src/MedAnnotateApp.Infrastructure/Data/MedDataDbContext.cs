using MedAnnotateApp.Core.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MedAnnotateApp.Infrastructure.Data;

public class MedDataDbContext : IdentityDbContext<User, IdentityRole, string>
{
    public DbSet<MedData> MedDatas { get; set; }
    public DbSet<MedDataKeyword> MedDataKeywords { get; set; }
    public DbSet<AnnotatedMedData> AnnotatedMedDatas { get; set; }
    public DbSet<AnnotatedByStudentsMedData> AnnotatedByStudentsMedDatas { get; set; }

    public MedDataDbContext(DbContextOptions<MedDataDbContext> options) : base(options) {}

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<MedData>()
            .Property(m => m.Id)
            .ValueGeneratedNever();
        
        modelBuilder.Entity<MedDataKeyword>()
            .HasOne(md => md.MedData)
            .WithMany(m => m.MedDataKeywords)
            .HasForeignKey(md => md.MedDataId);

        modelBuilder.Entity<MedData>()
            .Property(u => u.IsAnnotated)
            .HasDefaultValue(false);
    }
}