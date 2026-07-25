using MedAnnotateApp.Core.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MedAnnotateApp.Infrastructure.Data;

public class MedDataDbContext : IdentityDbContext<User, IdentityRole, string>
{
    public MedDataDbContext(DbContextOptions<MedDataDbContext> options) : base(options)
    {
    }

    public DbSet<MedData> MedDatas => Set<MedData>();
    public DbSet<MedDataKeyword> MedDataKeywords => Set<MedDataKeyword>();
    public DbSet<AnnotatedMedData> AnnotatedMedDatas => Set<AnnotatedMedData>();
    public DbSet<AnnotatedByStudentsMedData> AnnotatedByStudentsMedDatas => Set<AnnotatedByStudentsMedData>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<MedData>()
            .Property(medData => medData.Id)
            .ValueGeneratedNever();

        modelBuilder.Entity<MedDataKeyword>()
            .HasOne(medDataKeyword => medDataKeyword.MedData)
            .WithMany(medData => medData.MedDataKeywords)
            .HasForeignKey(medDataKeyword => medDataKeyword.MedDataId);

        modelBuilder.Entity<MedData>()
            .Property(medData => medData.IsAnnotated)
            .HasDefaultValue(false);
    }
}
