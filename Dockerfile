FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

COPY MedAnnotateApp.sln ./
COPY Directory.Build.props ./

COPY src/MedAnnotateApp.Core/*.csproj ./src/MedAnnotateApp.Core/
COPY src/MedAnnotateApp.Infrastructure/*.csproj ./src/MedAnnotateApp.Infrastructure/
COPY src/MedAnnotateApp.Presentation/*.csproj ./src/MedAnnotateApp.Presentation/
RUN dotnet restore src/MedAnnotateApp.Presentation/MedAnnotateApp.Presentation.csproj

COPY src/ ./src/
RUN dotnet publish src/MedAnnotateApp.Presentation/MedAnnotateApp.Presentation.csproj -c Release -o /app/out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0.14
WORKDIR /app
COPY --from=build-env /app/out .
RUN mkdir -p /app/keys && chown app:app /app/keys

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER app

ENTRYPOINT ["dotnet", "MedAnnotateApp.Presentation.dll"]
