# MedAnnotateApp

A web application for collecting structured annotations on medical publication images. Medical specialists mark regions associated with terms in the source text; medical students identify visible findings and supply their own labels. Both workflows preserve annotation data for research and future AI evaluation.

Built with **ASP.NET Core MVC, .NET 8, and PostgreSQL**, with custom canvas tools for rectangle and freehand annotation.

[Full walkthrough](https://drive.google.com/file/d/1WtMTApfPg1Q_AMeK0-lMWVt-EKZZpWtu/view?usp=sharing)

**The demos and screenshots show an earlier local development version.** Drawn regions and sample labels illustrate the interface, rather than validated medical annotations.

## Annotation workflows

### Medical specialists: annotate against source terms

Specialists work through highlighted medical terms in the publication text and mark the corresponding image regions. They can add comments, flag a term as not visible or abstract, or skip it when uncertain. Saving advances to the next term and records annotation timing.

<img width="1865" height="902" alt="DEMOSS2" src="https://github.com/user-attachments/assets/0bb8cbea-b1e3-4299-8545-15a0b9eda3a2" />

**Specialist demo · 56 seconds.** Drawing regions, using the magnifier, adding comments, and moving between terms.

https://github.com/user-attachments/assets/94dad84d-b075-431b-9890-afe414f0dc13

### Medical students: identify and label findings

Students annotate what they can identify and assign free-text labels. Regions can be grouped under a shared label, edited, or deleted before submission. These annotations provide a separate source of data for supplementary evaluation.

<img width="1866" height="902" alt="DEMOSS3" src="https://github.com/user-attachments/assets/24ac8b9f-e1f4-43b5-9394-5cb080c3b7c5" />

**Student demo · 50 seconds.** Creating regions, assigning labels, and editing annotation groups.

https://github.com/user-attachments/assets/b1e7f00c-6cef-4361-a3d1-9c89e0a28a19

### Drawing tools

Both workflows provide rectangle and freehand tools, with a magnifier for inspecting small details.

| Rectangle and freehand regions | Magnifier |
| --- | --- |
| <img width="620" height="502" alt="DEMOSS4" src="https://github.com/user-attachments/assets/eb2d3831-7b87-492a-931c-1be9b61ce850" /> | <img width="617" height="500" alt="DEMOSS5" src="https://github.com/user-attachments/assets/198f6b16-b2af-4671-afe8-07f9fab77733" /> |

### Participant access and image assignment

Participants pass a shared authorization gate, then register or log in through ASP.NET Core Identity. Registration accepts `stanford.edu` and `mountsinai.org` email addresses and collects profile information used to filter images by specialty, body region, modality, and role.

Selecting `medical student` assigns the `Medical_Student` role; other positions receive `Professional`. Each role has its own annotation workspace.

<details>
<summary>View participant registration</summary>

<img width="1866" height="902" alt="DEMOSS1" src="https://github.com/user-attachments/assets/0bb96c7e-f2d6-4b18-ad69-87c65388a849" />

The registration screen shows participant preferences and required-field validation. The [full walkthrough](https://drive.google.com/file/d/10KE4MSIjdLQpE0J9nxgl21jFsLJl3jjM/view?usp=sharing) provides the broader application demo.

</details>

## Stored annotations and progress

PostgreSQL stores annotations alongside source-image and participant metadata. Professional records include region coordinates, term decisions, comments, and timing data; student records retain grouped regions and their labels.

| Region coordinates | Annotation timing |
| --- | --- |
| <img width="757" height="216" alt="AnnotatedData1DB" src="https://github.com/user-attachments/assets/737b242b-0302-4df0-9f25-926f202920da" /> | <img width="111" height="215" alt="AnnotatedData2DB" src="https://github.com/user-attachments/assets/369f6c14-270e-41ba-9f27-ed3f43a8f3a3" /> |

Saved keyword states preserve progress when a specialist has not finished every term on an image. Separate ownership fields—`LockedByUserId` for professionals and `LockedByStudentUserId` for students—track image locks independently for each workflow, helping reduce overlapping work within a role. Completion is tracked through `IsAnnotated` and `IsAnnotatedByStudent`.

<img width="1095" height="132" alt="MedDataDB" src="https://github.com/user-attachments/assets/df6f775c-26a4-4d47-b5eb-c78cd420e7b8" />

<details>
<summary>Main database tables</summary>

| Table | Purpose |
| --- | --- |
| `MedDatas` | Source-image metadata, progress, and locks |
| `MedDataKeywords` | Extracted terms associated with images |
| `AnnotatedMedDatas` | Professional annotation records |
| `AnnotatedByStudentsMedDatas` | Student annotation groups |
| ASP.NET Core Identity tables | User accounts and roles |

</details>

## Architecture and stack

| Layer | Project | Contents |
| --- | --- | --- |
| Core | `src/MedAnnotateApp.Core` | Models, repositories, and core services |
| Infrastructure | `src/MedAnnotateApp.Infrastructure` | Data access, repository implementations, services, and settings |
| Presentation | `src/MedAnnotateApp.Presentation` | MVC controllers, Razor views, DTOs, migrations, and static assets |

The application uses ASP.NET Core Identity for accounts, EF Core 8 with Npgsql for PostgreSQL access, and EPPlus for Excel seed data. The interface uses Bootstrap, jQuery, and custom canvas annotation tools. Docker Compose runs the web app, PostgreSQL, and Redis.

## Run with Docker

From the repository root, use PowerShell:

```powershell
Copy-Item .env.example .env
# Configure .env before starting the app.
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080).

On startup, the app applies EF Core migrations, creates the `Medical_Student` and `Professional` roles if needed, and loads `mockPMCMIDdata7.xlsx` when `MedDatas` is empty.

### Configuration

Keep private values in `.env`, environment variables, or .NET user secrets.

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings:MedDataDb` | PostgreSQL connection string |
| `ConnectionStrings:RedisConnection` | Redis connection string for containerized environments |
| `AuthorizationAccessPasswordHash` | BCrypt hash for the shared authorization gate |
| `DataProtection:KeysPath` | Optional persisted data-protection key path |
| `SmtpSettings:*` | SMTP settings for email delivery |

Environment variables use double underscores for nested settings, such as `ConnectionStrings__MedDataDb` and `SmtpSettings__Password`. Supply a BCrypt hash for the authorization gate, rather than a plaintext password.

<details>
<summary>Run locally with the .NET SDK</summary>

Requires the .NET 8 SDK and a running PostgreSQL instance. The commands below use PowerShell; replace the placeholders with your local values.

```powershell
dotnet user-secrets init --project src/MedAnnotateApp.Presentation
dotnet user-secrets set "ConnectionStrings:MedDataDb" "Host=localhost;Port=5432;Database=meddatadb;Username=postgres;Password=<password>" --project src/MedAnnotateApp.Presentation
dotnet user-secrets set "AuthorizationAccessPasswordHash" '<bcrypt-hash>' --project src/MedAnnotateApp.Presentation
dotnet user-secrets set "SmtpSettings:Password" "<smtp-password>" --project src/MedAnnotateApp.Presentation

dotnet restore MedAnnotateApp.sln
dotnet build MedAnnotateApp.sln
dotnet run --project src/MedAnnotateApp.Presentation
```

Configure any other required SMTP settings under `SmtpSettings`. Development launch profiles use [https://localhost:7243](https://localhost:7243) or [http://localhost:5210](http://localhost:5210); use the URL printed at startup.

Entry route: `/Identity/AuthorizationAccess`. After authentication, users are routed to `/Home/Professional` or `/Home/Student`.

</details>

<details>
<summary>Manual database migrations</summary>

Migrations run automatically at startup. For manual migration work, install a compatible `dotnet-ef` tool and run:

```powershell
dotnet ef migrations add <MigrationName> --project src/MedAnnotateApp.Presentation --startup-project src/MedAnnotateApp.Presentation
dotnet ef database update --project src/MedAnnotateApp.Presentation --startup-project src/MedAnnotateApp.Presentation
```

</details>

## Current limitations

- Email confirmation support exists but is not active during signup.
- Redis is included in Docker Compose; session state currently uses the default in-app session services.
- The repository does not yet include an automated test project.

## License

Licensed under the [Apache License 2.0](LICENSE).
