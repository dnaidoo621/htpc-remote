# install-windows.ps1 — Glide HTPC Remote installer for Windows
# No administrator rights required.
#
# Usage (from the repo root in PowerShell):
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\install-windows.ps1
#
# The installer:
#   1. Verifies Python 3.9+ is available (installs via winget if not)
#   2. Copies the app to %LOCALAPPDATA%\htpc-remote
#   3. Creates a Python venv and installs dependencies
#   4. Creates a log file at %LOCALAPPDATA%\htpc-remote\htpc-remote.log
#   5. Registers an at-login Task Scheduler task that runs the server silently

$ErrorActionPreference = "Stop"

$TASK_NAME   = "htpc-remote"
$INSTALL_DIR = "$env:LOCALAPPDATA\htpc-remote"
$VENV        = "$INSTALL_DIR\venv"
$LOG_FILE    = "$INSTALL_DIR\htpc-remote.log"
$SCRIPT_DIR  = Split-Path $MyInvocation.MyCommand.Path -Parent

Write-Host ""
Write-Host "=== Glide HTPC Remote — Windows Installer ===" -ForegroundColor Cyan
Write-Host "Install dir : $INSTALL_DIR"
Write-Host ""

# ── 1. Python ────────────────────────────────────────────────────────────────
Write-Host "[1/5] Checking Python 3.9+..." -ForegroundColor Yellow
$pyOk = $false
try {
    $verStr = (python --version 2>&1).ToString().Trim()   # e.g. "Python 3.12.4"
    $parts  = ($verStr -replace 'Python ','').Split('.')
    if ([int]$parts[0] -ge 3 -and [int]$parts[1] -ge 9) {
        Write-Host "  -> $verStr" -ForegroundColor Green
        $pyOk = $true
    } else {
        Write-Host "  -> $verStr is too old (need >= 3.9)"
    }
} catch {}

if (-not $pyOk) {
    Write-Host "  Python not found or too old.  Installing via winget..." -ForegroundColor Yellow
    winget install --id Python.Python.3.12 --silent --accept-source-agreements --accept-package-agreements
    # Refresh PATH for this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
    $verStr = (python --version 2>&1).ToString().Trim()
    Write-Host "  -> $verStr installed" -ForegroundColor Green
}

# ── 2. Copy files ────────────────────────────────────────────────────────────
Write-Host "[2/5] Copying application files..." -ForegroundColor Yellow
if (Test-Path $INSTALL_DIR) {
    # Keep the existing venv if present — avoids re-downloading packages
    Get-ChildItem $INSTALL_DIR -Exclude "venv","htpc-remote.log" | Remove-Item -Recurse -Force
}
$exclude = @('.git','venv','__pycache__','*.pyc','*.deb','.deb-build')
Get-ChildItem $SCRIPT_DIR | Where-Object {
    $name = $_.Name
    -not ($exclude | Where-Object { $name -like $_ })
} | Copy-Item -Destination $INSTALL_DIR -Recurse -Force
Write-Host "  -> Files copied to $INSTALL_DIR" -ForegroundColor Green

# ── 3. Virtualenv + dependencies ─────────────────────────────────────────────
Write-Host "[3/5] Setting up Python virtualenv..." -ForegroundColor Yellow
if (-not (Test-Path "$VENV\Scripts\python.exe")) {
    python -m venv $VENV
}
& "$VENV\Scripts\pip.exe" install -q --upgrade pip
& "$VENV\Scripts\pip.exe" install -q -r "$INSTALL_DIR\requirements.txt"
Write-Host "  -> Dependencies installed" -ForegroundColor Green

# ── 4. Task Scheduler ─────────────────────────────────────────────────────────
Write-Host "[4/5] Registering startup task..." -ForegroundColor Yellow

# pythonw.exe runs without a console window; the QR overlay uses tkinter.
$pythonW = "$VENV\Scripts\pythonw.exe"
$runPy   = "$INSTALL_DIR\run.py"

# Redirect stdout/stderr to log file via a small wrapper script
$launcherPath = "$INSTALL_DIR\launcher.bat"
@"
@echo off
"$pythonW" "$runPy" >> "$LOG_FILE" 2>&1
"@ | Set-Content -Encoding ASCII $launcherPath

$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$launcherPath`""

$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit 0 `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited       # no elevation needed

Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask `
    -TaskName  $TASK_NAME `
    -Action    $action `
    -Trigger   $trigger `
    -Settings  $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host "  -> Task '$TASK_NAME' registered (runs at login)" -ForegroundColor Green

# ── 5. Start now ─────────────────────────────────────────────────────────────
Write-Host "[5/5] Starting service..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TASK_NAME
Start-Sleep -Seconds 2

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.PrefixOrigin -ne "WellKnown" -and $_.IPAddress -notmatch "^127\." } |
       Sort-Object InterfaceMetric |
       Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Remote URL : http://${ip}:8765" -ForegroundColor Cyan
Write-Host "  A QR code popup should appear on screen now."
Write-Host "  Scan it with your phone to start controlling."
Write-Host ""
Write-Host "  Logs    : Get-Content '$LOG_FILE' -Wait"
Write-Host "  Stop    : Stop-ScheduledTask   -TaskName '$TASK_NAME'"
Write-Host "  Remove  : Unregister-ScheduledTask -TaskName '$TASK_NAME' -Confirm:`$false"
Write-Host ""
