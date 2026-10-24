# ==============================================================================
# SafeSpace SSFRMS — Backend API Dockerfile (.NET 10 Minimal API)
# ==============================================================================

# ─── Stage 1: Build & Publish ────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS build
WORKDIR /src

# Sao chép các file cấu hình và project file để cache tầng restore
COPY global.json ./
COPY .config/dotnet-tools.json .config/
COPY StorageProject.slnx ./
COPY StorageProject.Core/StorageProject.Core.csproj StorageProject.Core/
COPY StorageProject.Infrastructure/StorageProject.Infrastructure.csproj StorageProject.Infrastructure/
COPY StorageProject.Api/StorageProject.Api.csproj StorageProject.Api/
COPY StorageProject.Tests/StorageProject.Tests.csproj StorageProject.Tests/
COPY StorageProject.IntegrationTests/StorageProject.IntegrationTests.csproj StorageProject.IntegrationTests/

RUN dotnet restore StorageProject.Api/StorageProject.Api.csproj

# Sao chép mã nguồn các project cần thiết
COPY StorageProject.Core/ StorageProject.Core/
COPY StorageProject.Infrastructure/ StorageProject.Infrastructure/
COPY StorageProject.Api/ StorageProject.Api/

WORKDIR /src/StorageProject.Api
RUN dotnet publish -c Release --no-restore -o /app/publish

# ─── Stage 2: Runtime Minimal Image (Non-root, Chiseled with ICU extra) ──────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra AS runtime
WORKDIR /app

# Biến môi trường chuẩn ASP.NET Core trong container
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

COPY --from=build /app/publish .

# Người dùng non-root (mặc định của noble-chiseled là 'app', UID: 1654)
USER $APP_UID

EXPOSE 8080

ENTRYPOINT ["dotnet", "StorageProject.Api.dll"]
