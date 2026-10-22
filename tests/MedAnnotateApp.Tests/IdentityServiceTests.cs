using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Infrastructure.Data;
using MedAnnotateApp.Infrastructure.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedAnnotateApp.Tests;

public class IdentityServiceTests
{
    [Fact]
    public async Task OrdinaryEmailSignupHashesPasswordAndCanSignInWithoutEmailConfirmation()
    {
        await using var fixture = await IdentityFixture.CreateAsync();
        var user = new User { Email = "specialist@gmail.com", UserName = "specialist@gmail.com" };
        var signup = await fixture.Identity.SignupAsync(user, "PersonalPassword1!", "Professional");

        Assert.True(signup.Succeeded);
        Assert.False(user.EmailConfirmed);
        Assert.NotNull(user.PasswordHash);
        Assert.NotEqual("PersonalPassword1!", user.PasswordHash);
        Assert.True(await fixture.Users.CheckPasswordAsync(user, "PersonalPassword1!"));
        Assert.True(await fixture.Users.IsInRoleAsync(user, "Professional"));

        var login = await fixture.Identity.LoginAsync(user.Email, "PersonalPassword1!");
        Assert.True(login.Succeeded);
        Assert.False(user.EmailConfirmed);
        Assert.True(fixture.Context.Response.Headers.SetCookie.Count > 0);
    }

    [Fact]
    public async Task ExistingUnconfirmedAccountKeepsPasswordAndRemainsUnconfirmedAfterLogin()
    {
        await using var fixture = await IdentityFixture.CreateAsync();
        var user = new User { Email = "existing@outlook.com", UserName = "existing@outlook.com", EmailConfirmed = false };
        Assert.True((await fixture.Users.CreateAsync(user, "ExistingPassword1!")).Succeeded);
        Assert.True((await fixture.Users.AddToRoleAsync(user, "Professional")).Succeeded);
        var passwordHash = user.PasswordHash;

        var login = await fixture.Identity.LoginAsync(user.Email, "ExistingPassword1!");

        Assert.True(login.Succeeded);
        Assert.False(user.EmailConfirmed);
        Assert.Equal(passwordHash, user.PasswordHash);
    }

    [Fact]
    public async Task IncorrectPasswordsAndUnknownEmailsHaveSameErrorAndFailuresCountTowardLockout()
    {
        await using var fixture = await IdentityFixture.CreateAsync();
        var user = new User { Email = "specialist@gmail.com", UserName = "specialist@gmail.com" };
        Assert.True((await fixture.Users.CreateAsync(user, "PersonalPassword1!")).Succeeded);

        var wrongPassword = await fixture.Identity.LoginAsync(user.Email, "WrongPassword1!");
        var unknownEmail = await fixture.Identity.LoginAsync("nobody@gmail.com", "WrongPassword1!");
        Assert.False(wrongPassword.Succeeded);
        Assert.Equal(unknownEmail.Errors, wrongPassword.Errors);
        Assert.Equal(1, await fixture.Users.GetAccessFailedCountAsync(user));
    }

    [Fact]
    public async Task SignupCannotChooseAnAdministrativeRole()
    {
        await using var fixture = await IdentityFixture.CreateAsync();
        var user = new User { Email = "someone@gmail.com", UserName = "someone@gmail.com" };

        Assert.False((await fixture.Identity.SignupAsync(user, "PersonalPassword1!", "Administrator")).Succeeded);
        Assert.Null(await fixture.Users.FindByEmailAsync(user.Email));
    }

    private sealed class IdentityFixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        private readonly ServiceProvider provider;
        private readonly IServiceScope scope;
        public DefaultHttpContext Context { get; }
        public UserManager<User> Users { get; }
        public IdentityService Identity { get; }

        private IdentityFixture(SqliteConnection connection, ServiceProvider provider, IServiceScope scope)
        {
            this.connection = connection;
            this.provider = provider;
            this.scope = scope;
            Context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
            scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>().HttpContext = Context;
            Users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var signIn = scope.ServiceProvider.GetRequiredService<SignInManager<User>>();
            // Pin the request on this fixture; IHttpContextAccessor uses an AsyncLocal
            // that does not flow back out of the asynchronous fixture factory.
            signIn.Context = Context;
            Identity = new IdentityService(Users, signIn);
        }

        public static async Task<IdentityFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddHttpContextAccessor();
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.AddDbContext<MedDataDbContext>(options => options.UseSqlite(connection));
            services.AddIdentity<User, IdentityRole>(options =>
            {
                options.SignIn.RequireConfirmedEmail = false;
                options.SignIn.RequireConfirmedAccount = false;
                options.Password.RequiredLength = 8;
            }).AddEntityFrameworkStores<MedDataDbContext>().AddDefaultTokenProviders();
            var provider = services.BuildServiceProvider();
            var scope = provider.CreateScope();
            await scope.ServiceProvider.GetRequiredService<MedDataDbContext>().Database.EnsureCreatedAsync();
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            Assert.True((await roles.CreateAsync(new IdentityRole("Professional"))).Succeeded);
            Assert.True((await roles.CreateAsync(new IdentityRole("Medical_Student"))).Succeeded);
            return new IdentityFixture(connection, provider, scope);
        }

        public async ValueTask DisposeAsync()
        {
            scope.Dispose();
            await provider.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
