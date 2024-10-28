// using MedAnnotateApp.Core.Models;
// using MedAnnotateApp.Core.Repositories;
// using MedAnnotateApp.Infrastructure.Data;
// using Microsoft.EntityFrameworkCore;

// namespace MedAnnotateApp.Infrastructure.Repositories;
// public class CounterRepository : ICounterRepository
// {
//     private readonly MedDataDbContext context;

//     public CounterRepository(MedDataDbContext context)
//     {
//         this.context = context;
//     }

//     public async Task<int> GetCurrentCounterAsync(string userId, string speciality)
//     {
//         var currentCounter = await context.CurrentCounters
//             .FirstOrDefaultAsync(c => c.UserId == userId && c.Speciality == speciality);

//         if (currentCounter == null)
//         {
//             var maxCounter = await context.MaxCounters
//                 .FirstOrDefaultAsync(m => m.Speciality == speciality);

//             if (maxCounter == null)
//             {
//                 maxCounter = new MaxCounter { Speciality = speciality, MaxValue = 1 };
//                 context.MaxCounters.Add(maxCounter);
//             }

//             currentCounter = new CurrentCounter
//             {
//                 UserId = userId,
//                 Speciality = speciality,
//                 CurrentValue = maxCounter != null ? maxCounter.MaxValue : 1,
//                 IsBeingAnnotated = false,
//             };
//             context.CurrentCounters.Add(currentCounter);
//             await context.SaveChangesAsync();
//         }

//         return currentCounter.CurrentValue;
//     }

//     public async Task<bool> UpdateCurrentCounterByUserIdAsync(string userId, string speciality)
//     {
//         var currentCounter = await context.CurrentCounters
//             .FirstOrDefaultAsync(c => c.UserId == userId && c.Speciality == speciality);

//         if (currentCounter == null)
//         {
//             await GetCurrentCounterAsync(userId, speciality);
//             return true;
//         }

//         var maxCounter = await context.MaxCounters
//             .FirstOrDefaultAsync(m => m.Speciality == speciality);

//         System.Console.WriteLine($"curr: {maxCounter.MaxValue}!!!!!!!!!!!!!!!!!!!!!");
//         System.Console.WriteLine($"curr: {currentCounter.CurrentValue}!!!!!!!!!!!!!!!!!!!!!");

//         currentCounter.CurrentValue = maxCounter!.MaxValue;
//         currentCounter.IsBeingAnnotated = false;
//         context.CurrentCounters.Update(currentCounter);
//         await context.SaveChangesAsync();

//         return true;
//     }

//     public async Task<bool> UpdateMaxCounterBySpecialityAsync(string userId, string speciality)
//     {
//         var currentCounter = await context.CurrentCounters
//             .FirstOrDefaultAsync(c => c.UserId == userId && c.Speciality == speciality);

//         if((currentCounter?.IsBeingAnnotated ?? false) == false) {
//             currentCounter!.IsBeingAnnotated = true;
//             context.CurrentCounters.Update(currentCounter);

//             var maxCounter = await context.MaxCounters
//                 .FirstOrDefaultAsync(m => m.Speciality == speciality);

//             if (maxCounter == null)
//             {
//                 maxCounter = new MaxCounter { Speciality = speciality, MaxValue = 1 };
//                 context.MaxCounters.Add(maxCounter);
//             }
//             else
//             {
//                 //  = await context.CurrentCounters.MaxAsync(c => c.CurrentValue) + 1
//                 System.Console.WriteLine($"max: {maxCounter.MaxValue}!!!!!!!!!!!!!!!!!!!!!");
//                 maxCounter.MaxValue += 1;
//                 context.MaxCounters.Update(maxCounter);
//             }

//             await context.SaveChangesAsync();
//             return true;
//         }

//         return false;
//     }
// }