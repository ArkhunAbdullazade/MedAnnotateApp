using System.IO.Compression;
using System.Text;
using System.Text.Json;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Infrastructure.Data;
using MedAnnotateApp.Infrastructure.Repositories;
using MedAnnotateApp.Infrastructure.Services.Admin;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace MedAnnotateApp.Tests;

public sealed class AdminServicesTests
{
    private const string Coordinates = """
        {"version":1,"coordinateSystem":"image-pixels","imageWidth":1000,"imageHeight":500,"annotations":[{"type":"rectangle","points":[[10,20],[100,20],[100,80],[10,80]]}]}
        """;

    [Fact]
    public async Task ReleasingPartialWorkKeepsTheAnswersAndTheNextSpecialistStartsAFullSet()
    {
        await using var db = await AdminDatabase.CreateAsync();
        await db.AssignAsync(db.First);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.First, Answer("lesion"))).Success);

        var result = await db.Assignments.ReleaseAsync(1, false, db.First.Id, db.Admin.Id);

        Assert.True(result.Released);
        Assert.Equal(1, result.KeptResponses);
        var image = await db.Context.MedDatas.AsNoTracking().SingleAsync(item => item.Id == 1);
        Assert.Null(image.LockedByUserId);
        Assert.Null(image.LockedAt);
        Assert.Null(image.KeywordStates);
        var audit = await db.Context.AdminActions.SingleAsync();
        Assert.Equal("release-specialist-lock", audit.Action);
        Assert.Equal(db.Admin.Id, audit.AdminUserId);
        Assert.Equal(db.First.Id, audit.TargetUserId);
        Assert.DoesNotContain("@", audit.Details);

        Assert.Equal(1, (await db.AssignAsync(db.Second)).MedData?.Id);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.Second, Answer("lesion"))).Success);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.Second, Answer("margin"))).Success);
        Assert.True((await db.Repository.CompleteProfessionalAsync(1, db.Second)).Success);
        // The first specialist's next save is refused with a message that tells them to reload.
        var late = await db.Repository.SaveProfessionalAsync(db.First, Answer("margin"));
        Assert.False(late.Success);
        Assert.Contains("Reload the page", late.Message);

        var complete = await db.Queries.GetResponsesAsync(new ResponseQuery { Completeness = Completeness.CompleteOnly });
        var incomplete = await db.Queries.GetResponsesAsync(new ResponseQuery { Completeness = Completeness.IncompleteOnly });
        var all = await db.Queries.GetResponsesAsync(new ResponseQuery());
        Assert.Equal(2, complete.Total);
        Assert.All(complete.Items, row => Assert.Equal(db.Second.Id, row.AnnotatorId));
        Assert.Equal(db.First.Id, Assert.Single(incomplete.Items).AnnotatorId);
        Assert.Equal(3, all.Total);
    }

    [Fact]
    public async Task ReleaseIsRefusedWhenTheLockChangedHands()
    {
        await using var db = await AdminDatabase.CreateAsync();
        await db.AssignAsync(db.First);

        var result = await db.Assignments.ReleaseAsync(1, false, db.Second.Id, db.Admin.Id);

        Assert.False(result.Released);
        Assert.Equal(db.First.Id, (await db.Context.MedDatas.AsNoTracking().SingleAsync(item => item.Id == 1)).LockedByUserId);
        Assert.Empty(await db.Context.AdminActions.ToListAsync());
    }

    [Fact]
    public async Task SweeperReleasesOnlyIdleEmptyLocks()
    {
        await using var db = await AdminDatabase.CreateAsync();
        await db.AssignAsync(db.First);               // image 1, will hold partial work
        await db.AssignAsync(db.Second);              // image 2, empty
        await db.AssignAsync(db.Student, true);       // image 1, student
        Assert.True((await db.Repository.SaveProfessionalAsync(db.First, Answer("lesion"))).Success);
        var now = DateTime.UtcNow;

        Assert.Equal(0, await db.Assignments.ReleaseIdleEmptyLocksAsync(TimeSpan.FromHours(12), now));

        foreach (var image in await db.Context.MedDatas.ToListAsync())
        {
            if (image.LockedAt != null) image.LockedAt = now.AddHours(-13);
            if (image.StudentLockedAt != null) image.StudentLockedAt = now.AddHours(-13);
        }
        foreach (var answer in await db.Context.AnnotatedMedDatas.ToListAsync())
            answer.CreatedAt = now.AddHours(-13);
        await db.Context.SaveChangesAsync();
        db.Context.ChangeTracker.Clear();

        Assert.Equal(2, await db.Assignments.ReleaseIdleEmptyLocksAsync(TimeSpan.FromHours(12), now));
        var images = await db.Context.MedDatas.AsNoTracking().OrderBy(item => item.Id).ToListAsync();
        Assert.Equal(db.First.Id, images[0].LockedByUserId);
        Assert.Null(images[0].LockedByStudentUserId);
        Assert.Null(images[1].LockedByUserId);
        Assert.Equal(1, await db.Context.AnnotatedMedDatas.CountAsync());
        Assert.All(await db.Context.AdminActions.ToListAsync(), action => Assert.Null(action.AdminUserId));

        var locks = await db.Queries.GetLocksAsync();
        var partial = Assert.Single(locks);
        Assert.True(partial.HasPartialWork);
        Assert.Equal(LockState.Stale, partial.State);
        Assert.Equal((1, 2), (partial.TermsSaved, partial.TermsTotal));
    }

    [Fact]
    public async Task OverviewCountsProgressPeopleAndGaps()
    {
        await using var db = await AdminDatabase.CreateAsync();
        await db.AssignAsync(db.First);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.First, Answer("lesion"))).Success);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.First, new AnnotatedMedData
        {
            MedDataId = 1, ExtractedKeyword = "margin", PressedButton = "Uncertain/Skip", Timestamps = "(0,0)"
        })).Success);
        Assert.True((await db.Repository.CompleteProfessionalAsync(1, db.First)).Success);
        await db.AssignAsync(db.Student, true);

        var overview = await db.Queries.GetOverviewAsync();

        Assert.Equal(3, overview.TotalImages);
        Assert.Equal(new RoleProgress(2, 1, 0, 1), overview.Specialist);
        Assert.Equal(new RoleProgress(3, 0, 1, 2), overview.Student);
        Assert.Equal((2, 1), (overview.Specialists, overview.Students));
        Assert.Equal(2, overview.SpecialistResponses);
        Assert.Equal(2, overview.ActiveNow);
        Assert.Contains(overview.ResponseMix, bin => bin.Label == "Uncertain/Skip" && bin.Count == 1);
        Assert.Equal(1, overview.FirstDrawSeconds.Sum(bin => bin.Count));
        // Image 3 is dermatology: no specialist or student selected it.
        Assert.Equal(1, overview.UnreachableStudentImages);
        Assert.Equal(1, overview.ImagesMissingKeywords);
        Assert.Contains(overview.Categories["Speciality"], item => item.Value == "cardiology" && item.Images == 2);
        Assert.Equal(2, overview.Activity.Sum(bucket => bucket.Specialist));
    }

    [Fact]
    public async Task ParticipantsShowCompletedPartialAndRemainingWork()
    {
        await using var db = await AdminDatabase.CreateAsync();
        await db.AssignAsync(db.First);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.First, Answer("lesion"))).Success);

        var participants = await db.Queries.GetParticipantsAsync();
        var first = participants.Single(row => row.Person.Id == db.First.Id);
        var detail = await db.Queries.GetParticipantAsync(db.First.Id);

        Assert.Equal(3, participants.Count);
        Assert.DoesNotContain(participants, row => row.Person.Id == db.Admin.Id);
        Assert.Equal((0, 1, 1), (first.ImagesCompleted, first.PartialImages, first.Responses));
        Assert.Equal([1], first.LockedImages);
        Assert.Equal(2, first.OpenImagesLeft);
        Assert.Equal("SPEC-001", first.Person.Code);
        var work = Assert.Single(detail!.Work);
        Assert.Equal((1, 2, true), (work.Answered, work.Total, work.Locked));
    }

    [Fact]
    public async Task ImagesFilterByStatusAndSearch()
    {
        await using var db = await AdminDatabase.CreateAsync();
        await db.AssignAsync(db.First);

        var inProgress = await db.Queries.GetImagesAsync(new ImageQuery { SpecialistStatus = "in-progress" });
        var dermatology = await db.Queries.GetImagesAsync(new ImageQuery { Speciality = "dermatology" });
        var byTerm = await db.Queries.GetImagesAsync(new ImageQuery { Search = "margin" });

        Assert.Equal(db.First.Id, Assert.Single(inProgress.Items).SpecialistHolder?.Id);
        Assert.Equal(3, Assert.Single(dermatology.Items).Id);
        Assert.Equal(1, Assert.Single(byTerm.Items).Id);
        var detail = await db.Queries.GetImageAsync(1);
        Assert.Equal(["lesion", "margin"], detail!.Keywords);
        Assert.Equal(db.First.Id, detail.SpecialistLock?.UserId);
    }

    [Theory]
    [InlineData(IdentityMode.Pseudonymous)]
    [InlineData(IdentityMode.Full)]
    [InlineData(IdentityMode.None)]
    public async Task ArchiveHoldsEveryTableAndOnlyFullIdentityHasEmails(IdentityMode identity)
    {
        await using var db = await AdminDatabase.CreateAsync();
        await db.AssignAsync(db.First);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.First, Answer("lesion", "=SUM(A1)"))).Success);
        await db.AssignAsync(db.Student, true);
        Assert.True((await db.Repository.SaveStudentAsync(db.Student,
            [new AnnotatedByStudentsMedData { MedDataId = 1, Coordinates = Coordinates, TextualAnnotation = "lesion, \"left\"" }])).Success);

        var files = await ReadArchiveAsync(await db.Export.CreateArchiveAsync(new ExportOptions { Identity = identity }));

        var expected = new List<string> { "README.txt", "images.csv", "progress.csv", "specialist_responses.csv", "student_annotations.csv" };
        if (identity != IdentityMode.None) expected.Add("participants.csv");
        Assert.Equal(expected.Order(), files.Keys.Order());
        Assert.Equal(identity == IdentityMode.Full, files.Values.Any(text => text.Contains("first@example.test")));
        var specialist = files["specialist_responses.csv"].Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, specialist.Length);
        Assert.Contains("'=SUM(A1)", specialist[1]);
        Assert.Contains("\"lesion, \"\"left\"\"\"", files["student_annotations.csv"]);
        Assert.Equal(identity != IdentityMode.None, specialist[0].Contains("AnnotatorCode"));
    }

    [Fact]
    public async Task IncompleteOnlyArchiveAndJsonFormat()
    {
        await using var db = await AdminDatabase.CreateAsync();
        await db.AssignAsync(db.First);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.First, Answer("lesion"))).Success);

        var files = await ReadArchiveAsync(await db.Export.CreateArchiveAsync(new ExportOptions
        {
            Completeness = Completeness.IncompleteOnly, Format = ExportFormat.Json
        }));

        using var answers = JsonDocument.Parse(files["specialist_responses.json"]);
        var row = Assert.Single(answers.RootElement.EnumerateArray());
        Assert.False(row.GetProperty("SetComplete").GetBoolean());
        Assert.Equal("SPEC-001", row.GetProperty("AnnotatorCode").GetString());
        Assert.Equal(1200, row.GetProperty("MsUntilFirstDraw").GetInt64());
        using var groups = JsonDocument.Parse(files["student_annotations.json"]);
        Assert.Empty(groups.RootElement.EnumerateArray());
        using var images = JsonDocument.Parse(files["images.json"]);
        Assert.Equal(3, images.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task ResponsesCsvFollowsTheFilter()
    {
        await using var db = await AdminDatabase.CreateAsync();
        await db.AssignAsync(db.First);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.First, Answer("lesion"))).Success);
        Assert.True((await db.Repository.SaveProfessionalAsync(db.First, Answer("margin"))).Success);

        await using var stream = await db.Export.CreateResponsesCsvAsync(new ResponseQuery { Term = "marg" }, IdentityMode.Pseudonymous);
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var lines = (await reader.ReadToEndAsync()).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(2, lines.Length);
        Assert.Contains(",margin,", lines[1]);
    }

    [Theory]
    [InlineData("(1200,3400)", 1200L, 3400L)]
    [InlineData("( 5 , 6 )", 5L, 6L)]
    [InlineData("(0,0)", null, null)]
    [InlineData("garbage", null, null)]
    [InlineData(null, null, null)]
    public void TimingsParseTheBrowserFormat(string? value, long? first, long? drawing) =>
        Assert.Equal((first, drawing), ResponseTimings.Parse(value));

    private static AnnotatedMedData Answer(string keyword, string? comment = null) => new()
    {
        MedDataId = 1, ExtractedKeyword = keyword, PressedButton = "Save and Next Term", BoxCoordinates = Coordinates,
        Timestamps = "(1200,3400)", Comment = comment
    };

    private static async Task<Dictionary<string, string>> ReadArchiveAsync(Stream stream)
    {
        await using (stream)
        {
            using var zip = new ZipArchive(stream, ZipArchiveMode.Read);
            var files = new Dictionary<string, string>();
            foreach (var entry in zip.Entries)
            {
                using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
                files[entry.FullName] = await reader.ReadToEndAsync();
            }
            return files;
        }
    }

    private sealed class AdminDatabase : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public MedDataDbContext Context { get; }
        public MedDataRepository Repository { get; }
        public AdminQueryService Queries { get; }
        public AssignmentAdminService Assignments { get; }
        public ResultsExportService Export { get; }
        public User First { get; } = Person("first", "specialist", "cardiology");
        public User Second { get; } = Person("second", "specialist", "cardiology");
        public User Student { get; } = Person("student", "medical student", "cardiology");
        public User Admin { get; } = new() { Id = "admin", Email = "admin@example.test", UserName = "admin@example.test" };

        private AdminDatabase(SqliteConnection connection)
        {
            this.connection = connection;
            Context = new MedDataDbContext(new DbContextOptionsBuilder<MedDataDbContext>().UseSqlite(connection).Options);
            Repository = new MedDataRepository(Context);
            Queries = new AdminQueryService(Context, new MemoryCache(new MemoryCacheOptions()), Options.Create(new AdminOptions()));
            Assignments = new AssignmentAdminService(Context);
            Export = new ResultsExportService(Context);
        }

        public static async Task<AdminDatabase> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var db = new AdminDatabase(connection);
            await db.Context.Database.EnsureCreatedAsync();
            var roles = new[] { "Professional", "Medical_Student", "Admin" }
                .Select(name => new IdentityRole(name) { Id = name, NormalizedName = name.ToUpperInvariant() }).ToList();
            db.Context.Roles.AddRange(roles);
            var created = DateTime.UtcNow.AddDays(-1);
            foreach (var (user, role) in new[] { (db.First, "Professional"), (db.Second, "Professional"), (db.Student, "Medical_Student"), (db.Admin, "Admin") })
            {
                user.CreatedAt = created = created.AddMinutes(1);
                db.Context.Users.Add(user);
                db.Context.UserRoles.Add(new IdentityUserRole<string> { UserId = user.Id, RoleId = role });
            }
            for (var id = 1; id <= 3; id++)
            {
                db.Context.MedDatas.Add(new()
                {
                    Id = id, ImageUrl = $"https://images.example.test/{id}.png", Pmcid = $"PMC{id}",
                    Speciality = id <= 2 ? "Cardiology" : "dermatology", BodyRegion = "chest", Modality = "ct"
                });
            }
            db.Context.MedDataKeywords.AddRange(
                new MedDataKeyword { MedDataId = 1, Keyword = "lesion" }, new MedDataKeyword { MedDataId = 1, Keyword = "margin" },
                new MedDataKeyword { MedDataId = 2, Keyword = "lesion" });
            await db.Context.SaveChangesAsync();
            return db;
        }

        public Task<(MedData? MedData, string Counter)> AssignAsync(User user, bool student = false) =>
            Repository.GetNthMedDataBySpecialityAndPositionAsync(user.Speciality,
                student ? "medical student" : "professional", user.BodyRegion, user.ImageModality, user.Id);

        private static User Person(string id, string position, string speciality) => new()
        {
            Id = id, Email = id + "@example.test", UserName = id + "@example.test", FullName = id, Position = position,
            Speciality = speciality, BodyRegion = "chest", ImageModality = "ct"
        };

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
