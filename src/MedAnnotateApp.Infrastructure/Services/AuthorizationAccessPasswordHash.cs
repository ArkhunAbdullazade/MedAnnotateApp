using System.Security.Cryptography;
using System.Text;

namespace MedAnnotateApp.Infrastructure.Services;

public static class AuthorizationAccessPasswordService
{
    // BCrypt is deliberately slow. Once the shared password has been verified, later correct entries are matched
    // with a keyed in-memory digest so a group joining together does not queue on the CPU; wrong passwords still
    // go through BCrypt, so guessing stays slow.
    private static readonly byte[] DigestKey = RandomNumberGenerator.GetBytes(32);
    private static VerifiedPassword? verified;

    public static string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    public static bool VerifyPassword(string password, string? hashedPassword)
    {
        if (string.IsNullOrWhiteSpace(hashedPassword))
        {
            return false;
        }

        var digest = HMACSHA256.HashData(DigestKey, Encoding.UTF8.GetBytes(password));
        if (verified is { } known && known.Hash == hashedPassword && CryptographicOperations.FixedTimeEquals(known.Digest, digest))
        {
            return true;
        }

        try
        {
            if (!BCrypt.Net.BCrypt.Verify(password, hashedPassword))
            {
                return false;
            }

            verified = new VerifiedPassword(hashedPassword, digest);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private sealed record VerifiedPassword(string Hash, byte[] Digest);
}
