FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-env
WORKDIR /app

COPY MedAnnotateApp.sln ./
COPY Directory.Build.props ./

COPY src/MedAnnotateApp.Core/*.csproj ./src/MedAnnotateApp.Core/
COPY src/MedAnnotateApp.Infrastructure/*.csproj ./src/MedAnnotateApp.Infrastructure/
COPY src/MedAnnotateApp.Presentation/*.csproj ./src/MedAnnotateApp.Presentation/
RUN dotnet restore MedAnnotateApp.sln

COPY src/ ./src/
RUN dotnet publish src/MedAnnotateApp.Presentation/MedAnnotateApp.Presentation.csproj -c Release -o /app/out --no-restore
COPY src/MedAnnotateApp.Presentation/mockPMCMIDdata7.xlsx /app/out/

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build-env /app/out .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "MedAnnotateApp.Presentation.dll"]
