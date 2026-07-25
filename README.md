# MedAnnotateApp

MedAnnotateApp is an ASP.NET Core MVC application for collecting structured visual annotations on medical publication images. It supports separate workflows for medical students and medical professionals, stores annotations in PostgreSQL, and seeds example medical image metadata from a bundled Excel workbook.

The app is designed for controlled annotation studies: users pass an authorization gate, sign up with an institutional email address, receive a role-based annotation screen, and are assigned images that match their specialty, body region, and image modality selections.

## Video Demo

> A partial development stage walkthrough of MedAnnotateApp locally.

[Watch the MedAnnotateApp video demo](https://drive.google.com/file/d/10KE4MSIjdLQpE0J9nxgl21jFsLJl3jjM/view?usp=sharing)

## Features

- Authorization gate before login and signup, backed by a BCrypt password hash.
- ASP.NET Core Identity accounts with `Medical_Student` and `Professional` roles.
- Signup validation for `stanford.edu` and `mountsinai.org` email addresses.
- Professional annotation workflow with highlighted clinical terms, rectangle/freehand drawing tools, magnifier support, skip/not-visible decisions, comments, and timing capture.
- Medical student workflow with grouped visual annotations and free-text labels.
- Image assignment filtered by user specialty, body region, image modality, and role.
- Per-user locking so two users do not annotate the same active image at the same time.
- EF Core migrations that run on application startup.
- Initial data seeding from `src/MedAnnotateApp.Presentation/mockPMCMIDdata7.xlsx` when the `MedDatas` table is empty.
- Docker Compose setup for the web app, PostgreSQL, and Redis.

## Tech Stack

- .NET 8
- ASP.NET Core MVC and Razor views
- ASP.NET Core Identity
- Entity Framework Core 8
- PostgreSQL with Npgsql
- EPPlus for Excel import
- Docker and Docker Compose
- Bootstrap, jQuery, and custom canvas-based annotation tools

## Project Structure

```text
.
|-- MedAnnotateApp.sln
|-- Directory.Build.props
|-- .env.example
|-- .gitignore
|-- Dockerfile
|-- docker-compose.yml
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

## Requirements

For Docker:

- Docker
- Docker Compose

For local development without Docker:

- .NET 8 SDK
- PostgreSQL
- Optional: `dotnet-ef` for creating or applying migrations manually

## Configuration

The application reads configuration from `appsettings.json`, `appsettings.Development.json`, environment variables, or user secrets.

No private credentials are committed. Use a local `.env` file for Docker Compose, environment variables, or .NET user secrets for development-only values.

Important settings:

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings:MedDataDb` | PostgreSQL connection string used by EF Core. |
| `ConnectionStrings:RedisConnection` | Redis connection string included for containerized environments. |
| `DataProtection:KeysPath` | Optional path for persisted ASP.NET Core data-protection keys. Docker uses `/app/keys`. |
| `AuthorizationAccessPasswordHash` | BCrypt hash for the first authorization gate. |
| `SmtpSettings:Server` | SMTP host for email delivery. |
| `SmtpSettings:Port` | SMTP port. |
| `SmtpSettings:SenderEmail` | Sender account email address. |
| `SmtpSettings:Password` | Sender account password or app password. |
| `SmtpSettings:EnableSsl` | Whether SMTP SSL is enabled. |

Do not commit production secrets. Prefer environment variables or .NET user secrets for private values. Environment variables use double underscores for nested keys:

```powershell
$env:ConnectionStrings__MedDataDb="Host=localhost;Port=5432;Database=meddatadb;Username=postgres;Password=<password>"
$env:AuthorizationAccessPasswordHash="<bcrypt-hash>"
$env:SmtpSettings__Password="<smtp-password>"
```

`AuthorizationAccessPasswordHash` must be a BCrypt hash compatible with `BCrypt.Net-Next`.

## Quick Start With Docker

From the repository root:

```powershell
Copy-Item .env.example .env
# Edit .env and set POSTGRES_PASSWORD plus AUTHORIZATION_ACCESS_PASSWORD_HASH.
docker compose up --build
```

Open:

```text
http://localhost:8080
```

On startup, the app will:

1. Connect to PostgreSQL.
2. Apply EF Core migrations.
3. Create the `Medical_Student` and `Professional` roles if they do not exist.
4. Load the bundled Excel data into the database if `MedDatas` is empty.

The Compose file reads database, SMTP, and authorization-gate values from `.env` or your shell environment.

## Local Development

Start PostgreSQL and create a database named `meddatadb`, or update the connection string to point at your own database.

For user secrets:

```powershell
dotnet user-secrets init --project src\MedAnnotateApp.Presentation
dotnet user-secrets set "ConnectionStrings:MedDataDb" "Host=localhost;Port=5432;Database=meddatadb;Username=postgres;Password=<password>" --project src\MedAnnotateApp.Presentation
dotnet user-secrets set "AuthorizationAccessPasswordHash" "<bcrypt-hash>" --project src\MedAnnotateApp.Presentation
dotnet user-secrets set "SmtpSettings:Password" "<smtp-password>" --project src\MedAnnotateApp.Presentation
```

Run the app from the solution root:

```powershell
dotnet restore MedAnnotateApp.sln
dotnet build MedAnnotateApp.sln
dotnet run --project src\MedAnnotateApp.Presentation
```

The development profile serves the app at:

```text
https://localhost:7243
http://localhost:5210
```

The seed loader now resolves `mockPMCMIDdata7.xlsx` from the Presentation project's content root, so `dotnet run --project src\MedAnnotateApp.Presentation` also works from the solution root.

## Application Flow

1. A visitor lands on `/Identity/AuthorizationAccess`.
2. The visitor enters the shared authorization password.
3. After passing the gate, the visitor can log in or sign up.
4. During signup, the selected `Position` determines the role:
   - `medical student` becomes `Medical_Student`
   - every other position becomes `Professional`
5. Authenticated users are redirected to their role-specific page:
   - `/Home/Student`
   - `/Home/Professional`
6. The app assigns the next available image that matches the user's specialty, body region, and modality selections.
7. Submitted annotations are saved with the original image metadata and user profile metadata.

## Annotation Data

Core tables managed by the app include:

- `MedDatas`: source image metadata loaded from the Excel workbook.
- `MedDataKeywords`: extracted keywords associated with each image.
- `AnnotatedMedDatas`: professional annotations, including coordinates, keyword, button decision, timestamps, comments, and user metadata.
- `AnnotatedByStudentsMedDatas`: student annotations, including grouped coordinates, textual labels, and user metadata.
- ASP.NET Core Identity tables for users, roles, claims, and logins.

## Migrations

The application applies migrations automatically during startup. To create a new migration manually:

```powershell
dotnet ef migrations add <MigrationName> --project src\MedAnnotateApp.Presentation --startup-project src\MedAnnotateApp.Presentation
```

To apply migrations manually:

```powershell
dotnet ef database update --project src\MedAnnotateApp.Presentation --startup-project src\MedAnnotateApp.Presentation
```

## Common Issues

### Database connection fails

Use `Host=localhost` when running the app directly on your machine. Use the Compose service/container host configured for Docker when running inside Docker.

### No data appears for annotation

Check that:

- The database is reachable.
- Migrations completed successfully.
- `mockPMCMIDdata7.xlsx` exists in the app working directory.
- The `MedDatas` table is not already fully annotated.
- The user's specialty, body region, and image modality selections match seeded records.

### Users keep returning to the authorization page

The authorization gate is stored in session state. A new browser session, cleared cookies, or server restart can require users to pass the gate again.

### Authorization password is always rejected

Check that `AuthorizationAccessPasswordHash` is configured and is a valid BCrypt hash.

## Development Notes

- There is currently no test project in the solution.
- Build output, IDE state, `.csproj.user` files, local `.env` files, and data-protection keys are ignored by git.
- Email confirmation code exists but is currently not active during signup.
- Redis is included in Docker Compose and configuration, but session state is currently configured with the default in-app session services.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
