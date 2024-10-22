using MedAnnotateApp.Core.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MedAnnotateApp.Infrastructure.Data;

public class MedDataDbContext : IdentityDbContext<User, IdentityRole, string>
{
    public MedDataDbContext(DbContextOptions<MedDataDbContext> options) : base(options) {}
  
}