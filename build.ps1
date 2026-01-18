# Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
# All rights reserved.
# Unauthorized use without prior written consent is strictly prohibited.

# EnZIM Build Script for Windows
# Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

param(
    [string]$Command = "build"
)

$ErrorActionPreference = "Stop"

# Version info
$VERSION = "0.1.0"

# Calculate epoch-based build number (last 5 digits of epoch minutes)
function Get-BuildNumber {
    $epochSeconds = [int][double]::Parse((Get-Date -UFormat %s))
    $epochMinutes = [math]::Floor($epochSeconds / 60)
    $buildNumber = $epochMinutes % 100000
    return "{0:D5}" -f $buildNumber
}

$BUILD_NUMBER = Get-BuildNumber
$FULL_VERSION = "v$VERSION.$BUILD_NUMBER"

Write-Host "EnZIM Build Script" -ForegroundColor Green
Write-Host "Version: $FULL_VERSION"
Write-Host "Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved."
Write-Host ""

function Update-TauriVersion {
    Write-Host "Updating version in tauri.conf.json..." -ForegroundColor Yellow
    $configPath = "src-tauri/tauri.conf.json"
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
    $config.version = $VERSION
    $config | ConvertTo-Json -Depth 10 | Set-Content $configPath
}

function Build-Frontend {
    Write-Host "Building frontend..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
    Write-Host "Frontend built successfully." -ForegroundColor Green
}

function Build-Tauri {
    Write-Host "Building Tauri application..." -ForegroundColor Yellow
    npm run tauri build
    if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }
    Write-Host "Tauri application built successfully." -ForegroundColor Green
}

function Start-Dev {
    Write-Host "Starting development server..." -ForegroundColor Yellow
    npm run tauri dev
}

function Rename-Artifacts {
    Write-Host "Renaming artifacts with version..." -ForegroundColor Yellow
    
    $distDir = "src-tauri/target/release/bundle"
    
    # MSI artifacts
    $msiDir = Join-Path $distDir "msi"
    if (Test-Path $msiDir) {
        Get-ChildItem "$msiDir/*.msi" | ForEach-Object {
            $newName = $_.Name -replace '\.msi$', "_$BUILD_NUMBER.msi"
            Rename-Item $_.FullName -NewName $newName -ErrorAction SilentlyContinue
        }
    }
    
    # NSIS artifacts
    $nsisDir = Join-Path $distDir "nsis"
    if (Test-Path $nsisDir) {
        Get-ChildItem "$nsisDir/*.exe" | ForEach-Object {
            $newName = $_.Name -replace '\.exe$', "_$BUILD_NUMBER.exe"
            Rename-Item $_.FullName -NewName $newName -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host "Artifacts renamed." -ForegroundColor Green
}

function Show-Help {
    Write-Host "Usage: .\build.ps1 [-Command <command>]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  dev       Start development server"
    Write-Host "  build     Build for production (current platform)"
    Write-Host "  frontend  Build frontend only"
    Write-Host "  version   Show version info"
    Write-Host "  help      Show this help message"
    Write-Host ""
    Write-Host "Build number: $BUILD_NUMBER"
    Write-Host "Full version: $FULL_VERSION"
}

switch ($Command.ToLower()) {
    "dev" {
        Start-Dev
    }
    "build" {
        Update-TauriVersion
        Build-Frontend
        Build-Tauri
        Rename-Artifacts
        Write-Host ""
        Write-Host "Build complete!" -ForegroundColor Green
        Write-Host "Version: $FULL_VERSION"
    }
    "frontend" {
        Build-Frontend
    }
    "version" {
        Write-Host $FULL_VERSION
    }
    { $_ -in "help", "--help", "-h" } {
        Show-Help
    }
    default {
        Write-Host "Unknown command: $Command" -ForegroundColor Red
        Show-Help
        exit 1
    }
}
