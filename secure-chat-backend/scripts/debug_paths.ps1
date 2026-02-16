$scriptPath = $PSScriptRoot
$migrationPath = Join-Path $PSScriptRoot "..\migrations"
$resolvedMigrationPath = Resolve-Path $migrationPath
Write-Host "Script Path: $scriptPath"
Write-Host "Migration Path (Raw): $migrationPath"
Write-Host "Migration Path (Resolved): $resolvedMigrationPath"

$files = Get-ChildItem -Path $migrationPath -Filter "*.sql"
Write-Host "Found $($files.Count) migration files."
foreach ($f in $files[0..2]) { Write-Host " - $($f.Name)" }
