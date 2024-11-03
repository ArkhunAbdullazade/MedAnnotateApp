FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-env
WORKDIR /app

COPY MedAnnotateApp.sln ./

COPY src/MedAnnotateApp.Core/*.csproj ./src/MedAnnotateApp.Core/
COPY src/MedAnnotateApp.Infrastructure/*.csproj ./src/MedAnnotateApp.Infrastructure/
COPY src/MedAnnotateApp.Presentation/*.csproj ./src/MedAnnotateApp.Presentation/
RUN dotnet restore

COPY src/ ./src/
RUN dotnet publish src/MedAnnotateApp.Presentation -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "MedAnnotateApp.Presentation.dll"]