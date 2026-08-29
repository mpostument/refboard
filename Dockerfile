# syntax=docker/dockerfile:1

# Two-stage, cross-compiled rather than emulated: the build stage is pinned to
# the machine's own native platform (--platform=$BUILDPLATFORM) and asks the
# .NET SDK to target $TARGETARCH directly via `-a`, so a multi-arch build on
# GitHub Actions' amd64 runners produces the arm64 image at native SDK speed
# instead of running the whole build under QEMU emulation.
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
# Stamped into the assembly so /healthz - and the page footer that reads it -
# report the version actually running, not whatever Refboard.csproj's own
# default happens to say. docker.yml derives this from the git tag; a plain
# `docker build` with no --build-arg falls back to the csproj default.
ARG VERSION=0.0.0-dev
WORKDIR /src

COPY src/Refboard/Refboard.csproj .
RUN dotnet restore -a $TARGETARCH

COPY src/Refboard/. .
RUN dotnet publish -c Release -a $TARGETARCH --no-restore -o /app -p:Version=$VERSION

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

# curl only for the HEALTHCHECK below - the base runtime image ships without
# it. A few MB is a fair trade for a healthcheck that works out of the box.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app .

ENV SOURCE_DIR=/references \
    DATA_DIR=/data \
    PORT=8080

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8080/healthz || exit 1

ENTRYPOINT ["dotnet", "Refboard.dll"]
