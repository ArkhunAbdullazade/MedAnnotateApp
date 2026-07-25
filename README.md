# MedAnnotateApp

MedAnnotateApp is an ASP.NET Core MVC application for collecting structured annotations on medical publication images. It supports separate professional and medical-student workflows, stores data in PostgreSQL, and can seed sample image metadata from the bundled Excel workbook.

The app is intended for controlled annotation studies: participants pass an authorization gate, register with an approved institutional email address, and receive images filtered by specialty, body region, modality, and role.

## Video Demo

The following walkthrough shows an older local development version of the project:

[Watch the MedAnnotateApp video demo](https://drive.google.com/file/d/10KE4MSIjdLQpE0J9nxgl21jFsLJl3jjM/view?usp=sharing)

## Features

- Shared authorization gate backed by a BCrypt password hash.
- ASP.NET Core Identity users with `Medical_Student` and `Professional` roles.
- Institutional email validation for `stanford.edu` and `mountsinai.org`.
- Professional workflow with keyword highlighting, rectangle/freehand annotation, magnifier support, comments, skip/not-visible decisions, and timing capture.
- Student workflow with grouped visual annotations and free-text labels.
- Per-user image locking to reduce concurrent work on the same image.
- Automatic EF Core migration and seed loading on startup.
- Docker Compose setup for the web app, PostgreSQL, and Redis.

## Stack

- .NET 8
- ASP.NET Core MVC and Razor views
- ASP.NET Core Identity
- Entity Framework Core 8
- PostgreSQL with Npgsql
- EPPlus
- Bootstrap, jQuery, and custom canvas annotation tools
- Docker and Docker Compose

## Project Layout

```text
.
|-- MedAnnotateApp.sln
|-- Directory.Build.props
|-- Dockerfile
|-- docker-compose.yml
|-- .env.example
|-- src
|   |-- MedAnnotateApp.Core
|   |   |-- Models
|   |   |-- Repositories
|   |   `-- Services
|   |-- MedAnnotateApp.Infrastructure
|   |   |-- Data
|   |   |-- Repositories
|   |   |-- Services
|   |   `-- Settings
|   `-- MedAnnotateApp.Presentation
|       |-- Controllers
|       |-- Dtos
|       |-- Migrations
|       |-- Views
|       |-- wwwroot
|       `-- Program.cs
`-- LICENSE
```

## Configuration

Private values are intentionally not committed. Configure them with Docker `.env`, environment variables, or .NET user secrets.

Key settings:

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings:MedDataDb` | PostgreSQL connection string. |
| `ConnectionStrings:RedisConnection` | Redis connection string for containerized environments. |
| `AuthorizationAccessPasswordHash` | BCrypt hash for the authorization gate. |
| `DataProtection:KeysPath` | Optional persisted ASP.NET Core data-protection key path. |
| `SmtpSettings:*` | SMTP configuration for email delivery. |

Environment variables use double underscores for nested keys:

```powershell
$env:ConnectionStrings__MedDataDb="Host=localhost;Port=5432;Database=meddatadb;Username=postgres;Password=<password>"
$env:AuthorizationAccessPasswordHash="<bcrypt-hash>"
$env:SmtpSettings__Password="<smtp-password>"
```

## Run With Docker

```powershell
Copy-Item .env.example .env
# Edit .env before starting the app.
docker compose up --build
```

Open `http://localhost:8080`.

On startup, the app applies migrations, creates the `Medical_Student` and `Professional` roles if needed, and seeds `mockPMCMIDdata7.xlsx` when `MedDatas` is empty.

## Run Locally

Requirements:

- .NET 8 SDK
- PostgreSQL
- Optional: `dotnet-ef` for manual migration work

Set local secrets:

```powershell
dotnet user-secrets init --project src\MedAnnotateApp.Presentation
dotnet user-secrets set "ConnectionStrings:MedDataDb" "Host=localhost;Port=5432;Database=meddatadb;Username=postgres;Password=<password>" --project src\MedAnnotateApp.Presentation
dotnet user-secrets set "AuthorizationAccessPasswordHash" "<bcrypt-hash>" --project src\MedAnnotateApp.Presentation
dotnet user-secrets set "SmtpSettings:Password" "<smtp-password>" --project src\MedAnnotateApp.Presentation
```

Build and run:

```powershell
dotnet restore MedAnnotateApp.sln
dotnet build MedAnnotateApp.sln
dotnet run --project src\MedAnnotateApp.Presentation
```

Development launch profiles serve:

```text
https://localhost:7243
http://localhost:5210
```

## Application Flow

1. A visitor starts at `/Identity/AuthorizationAccess`.
2. After passing the gate, the visitor can log in or sign up.
3. Signup assigns `Medical_Student` when the selected position is `medical student`; other positions receive `Professional`.
4. Authenticated users land on `/Home/Student` or `/Home/Professional`.
5. The app locks and serves the next matching unannotated image.
6. Saved annotations include source image metadata and user profile metadata.

## Data

Main application tables:

- `MedDatas`: source image metadata.
- `MedDataKeywords`: extracted terms attached to images.
- `AnnotatedMedDatas`: professional annotations.
- `AnnotatedByStudentsMedDatas`: student annotation groups.
- ASP.NET Core Identity tables.

## Migrations

The app applies migrations automatically on startup. Manual commands:

```powershell
dotnet ef migrations add <MigrationName> --project src\MedAnnotateApp.Presentation --startup-project src\MedAnnotateApp.Presentation
dotnet ef database update --project src\MedAnnotateApp.Presentation --startup-project src\MedAnnotateApp.Presentation
```

## Notes

- Build outputs, IDE state, `.csproj.user`, local `.env`, and data-protection keys are ignored by git.
- Email confirmation support exists in the codebase but is not active during signup.
- Redis is available in Docker Compose, while session state currently uses the default in-app session services.
- There is no automated test project yet.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
