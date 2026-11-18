# syntax=docker/dockerfile:1

# 1) Build the React app
FROM node:22-alpine AS web
WORKDIR /src/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

# 2) Publish the API with the SPA inside wwwroot (single origin, DEC-010)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src/apps/api
COPY apps/api/Directory.Build.props apps/api/Directory.Packages.props ./
COPY apps/api/src/Bookly.Api/Bookly.Api.csproj src/Bookly.Api/
RUN dotnet restore src/Bookly.Api/Bookly.Api.csproj
COPY apps/api/src/ src/
COPY --from=web /src/apps/web/dist/ src/Bookly.Api/wwwroot/
RUN dotnet publish src/Bookly.Api/Bookly.Api.csproj -c Release -o /app --no-restore

# 3) Runtime (non-chiseled: tzdata is needed for Europe/Rome)
FROM mcr.microsoft.com/dotnet/aspnet:11.0 AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    TZ=Etc/UTC
EXPOSE 8080
COPY --from=api /app ./
USER $APP_UID
ENTRYPOINT ["dotnet", "Bookly.Api.dll"]
