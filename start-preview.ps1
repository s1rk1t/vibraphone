$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$mobileRoot = Join-Path $repoRoot "mobile-app"

function Test-ListeningPort {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    try {
        Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Start-PreviewWindow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $escapedDirectory = $WorkingDirectory.Replace("'", "''")
    $windowCommand = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location '$escapedDirectory'
$Command
"@

    Start-Process -FilePath "powershell.exe" `
        -WorkingDirectory $WorkingDirectory `
        -ArgumentList "-NoExit", "-Command", $windowCommand | Out-Null
}

if (-not (Test-Path (Join-Path $mobileRoot "node_modules"))) {
    Write-Warning "Frontend dependencies are missing. Run 'npm install' in mobile-app before launching the preview."
}

if (Test-ListeningPort -Port 8080) {
    Write-Warning "Port 8080 is already in use. Skipping backend startup."
} else {
    Start-PreviewWindow -Title "Vibraphone Backend" -WorkingDirectory $repoRoot -Command "mvn spring-boot:run"
}

if (Test-ListeningPort -Port 5173) {
    Write-Warning "Port 5173 is already in use. Skipping frontend startup."
} else {
    Start-PreviewWindow -Title "Vibraphone Frontend" -WorkingDirectory $mobileRoot -Command "npm run dev"
}

Write-Host ""
Write-Host "Preview servers are starting in separate windows."
Write-Host "Frontend URL: http://localhost:5173"
Write-Host "Backend URL:  http://localhost:8080"
Write-Host "Keep both windows open while previewing the app."
