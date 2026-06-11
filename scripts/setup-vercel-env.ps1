# Sets Vercel environment variables from local .env (run after: vercel login && vercel link)
param(
  [Parameter(Mandatory = $true)]
  [string]$AppUrl
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
  throw ".env not found at $envFile"
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $idx = $_.IndexOf('=')
  if ($idx -lt 1) { return }
  $key = $_.Substring(0, $idx).Trim()
  $value = $_.Substring($idx + 1).Trim()
  $vars[$key] = $value
}

if (-not $vars['DATABASE_URL']) {
  throw "DATABASE_URL is missing from .env"
}

$jwtSecret = $vars['JWT_SECRET']
if (-not $jwtSecret -or $jwtSecret -eq 'super_secret_jwt_sign_key_123_abc') {
  $jwtSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
  Write-Host "Generated a new production JWT_SECRET."
}

$entries = @{
  DATABASE_URL = $vars['DATABASE_URL']
  JWT_SECRET   = $jwtSecret
  CORS_ORIGIN  = $AppUrl.TrimEnd('/')
  APP_URL      = $AppUrl.TrimEnd('/')
}

function Set-VercelEnv {
  param([string]$Name, [string]$Value)
  Write-Host "Setting $Name for production, preview, development..."
  $Value | vercel env add $Name production preview development --force --yes | Out-Null
}

Push-Location $root
try {
  vercel whoami | Out-Null
} catch {
  throw "Not logged in to Vercel. Run: vercel login"
}

if (-not (Test-Path ".vercel/project.json")) {
  throw "Project not linked. Run: vercel link"
}

foreach ($entry in $entries.GetEnumerator()) {
  Set-VercelEnv -Name $entry.Key -Value $entry.Value
}

Write-Host ""
Write-Host "Done. Redeploy for changes to take effect:"
Write-Host "  vercel --prod"
Write-Host ""
Write-Host "If JWT_SECRET was generated above, save it somewhere safe:"
Write-Host "  JWT_SECRET=$jwtSecret"

Pop-Location
