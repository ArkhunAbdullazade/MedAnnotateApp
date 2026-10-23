using System.Threading.RateLimiting;

namespace MedAnnotateApp.Presentation.Models;

// Gate, login and signup submissions per client address. Participants at one hospital or university often
// share a single public address, so the limit must fit a whole group joining together; per-account lockout
// still stops password guessing against individual accounts.
public static class ResearchAccessRateLimit
{
    public const string PolicyName = "research-access";
    public const string LimitSetting = "RateLimiting:AccessAttemptsPerTenMinutes";
    public const int DefaultPermitLimit = 300;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(10);

    public static RateLimitPartition<string> Partition(HttpContext context, int permitLimit) =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit, Window = Window, QueueLimit = 0, AutoReplenishment = true
            });
}
