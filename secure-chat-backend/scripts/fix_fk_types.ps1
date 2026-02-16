# scripts/fix_fk_types.ps1
# Bulk replaces INT with VARCHAR(255) for User ID columns in migrations

$migrationsDir = Join-Path $PSScriptRoot "..\migrations"
$files = Get-ChildItem -Path $migrationsDir -Filter "*.sql"

Write-Host "Scanning $($files.Count) files in $migrationsDir..."

foreach ($f in $files) {
    $content = Get-Content -Path $f.FullName -Raw
    $originalContent = $content
    
    # 1. Generic User ID Fix: `*user_id` INT
    # Matches `user_id`, `created_by_user_id`, `target_user_id`, etc.
    $content = $content -replace "`"(\w*user_id)`"\s+INT", "`"$1`" VARCHAR(255)"
    
    # 2. Sender ID Fix: `*sender_id` INT
    $content = $content -replace "`"(\w*sender_id)`"\s+INT", "`"$1`" VARCHAR(255)"
    
    if ($content -ne $originalContent) {
        Write-Host "FIXED: $($f.Name)"
        Set-Content -Path $f.FullName -Value $content -Encoding UTF8
    }
}

Write-Host "Bulk fix completed."
