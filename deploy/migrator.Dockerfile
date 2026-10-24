# ==============================================================================
# SafeSpace SSFRMS — EF Core Migration Bundle Dockerfile
# ==============================================================================

# ─── Stage 1: Build Migration Bundle ──────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS build
WORKDIR /src

# Cài đặt / restore dotnet-ef tool
COPY global.json ./
COPY .config/dotnet-tools.json .config/
COPY StorageProject.slnx ./
COPY StorageProject.Core/StorageProject.Core.csproj StorageProject.Core/
COPY StorageProject.Infrastructure/StorageProject.Infrastructure.csproj StorageProject.Infrastructure/
COPY StorageProject.Api/StorageProject.Api.csproj StorageProject.Api/
COPY StorageProject.Tests/StorageProject.Tests.csproj StorageProject.Tests/
COPY StorageProject.IntegrationTests/StorageProject.IntegrationTests.csproj StorageProject.IntegrationTests/

RUN dotnet tool restore
RUN dotnet restore StorageProject.Api/StorageProject.Api.csproj

COPY StorageProject.Core/ StorageProject.Core/
COPY StorageProject.Infrastructure/ StorageProject.Infrastructure/
COPY StorageProject.Api/ StorageProject.Api/

# Tạo migration executable bundle tự độc lập (self-contained linux-x64)
RUN dotnet dotnet-ef migrations bundle \
    --project StorageProject.Infrastructure \
    --startup-project StorageProject.Api \
    --output /app/efbundle \
    --self-contained \
    -r linux-x64 \
    --verbose

# ─── Stage 2: Runtime Image (Chiseled runtime-deps with ICU extra) ────────────
FROM mcr.microsoft.com/dotnet/runtime-deps:10.0-noble-chiseled-extra AS runtime
WORKDIR /app

ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

COPY --from=build /app/efbundle .

USER $APP_UID

# Nhận connection string qua biến môi trường hoặc tham số dòng lệnh lúc chạy
ENTRYPOINT ["/app/efbundle"]
