# scripts/ConsolidateSchema.ps1
# Merges all migrations into a single SQL file for easy Restore.

$migrationDir = Join-Path $PSScriptRoot "..\migrations"
$outputFile = Join-Path $PSScriptRoot "..\latest_schema_complete.sql"

$files = Get-ChildItem -Path $migrationDir -Filter "*.sql" | Sort-Object Name

$header = "-- ChatFlect Complete Schema (Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))`n-- Version: v15.0 (RC1)`n`n"
Set-Content -Path $outputFile -Value $header -Encoding UTF8

# 1. Add Base Schema (V2)
$baseSchema = Join-Path $PSScriptRoot "..\full_schema_v2.sql"
if (Test-Path $baseSchema) {
    Write-Host "Adding Base Schema: full_schema_v2.sql"
    $baseContent = Get-Content -Path $baseSchema -Raw
    
    # FILTER: Remove tables that are fully redefined in newer migrations
    # Removing 'groups', 'group_members', 'calls' to allow Migrations 024, 084 to take precedence.
    # regex note: . matches the backtick
    $baseContent = $baseContent -replace "(?ms)CREATE TABLE .groups..*?ENGINE=InnoDB.*?;", "-- REMOVED LEGACY groups (Superceded by 024)"
    $baseContent = $baseContent -replace "(?ms)CREATE TABLE .group_members..*?ENGINE=InnoDB.*?;", "-- REMOVED LEGACY group_members (Superceded by 024)"
    $baseContent = $baseContent -replace "(?ms)CREATE TABLE .calls..*?ENGINE=InnoDB.*?;", "-- REMOVED LEGACY calls (Superceded by 084)"

    Add-Content -Path $outputFile -Value "`n-- BASE SCHEMA (V2) --`n" -Encoding UTF8
    Add-Content -Path $outputFile -Value $baseContent -Encoding UTF8
    
    # FIX: Dependency Injection
    # 'messages' table is created in 012 but altered in 007. We must create it here.
    $messagesTable = @"

-- INJECTED DEPENDENCY: messages (from 012_relay_messages.sql)
DROP TABLE IF EXISTS messages;
CREATE TABLE IF NOT EXISTS messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chat_id VARCHAR(128) NOT NULL,
    sender_id VARCHAR(128) NOT NULL,
    server_seq BIGINT NOT NULL,
    message_uuid VARCHAR(128) NOT NULL, 
    encrypted_payload TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    server_received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_message_uuid UNIQUE (message_uuid),
    CONSTRAINT uk_chat_seq UNIQUE (chat_id, server_seq),
    INDEX idx_chat_seq (chat_id, server_seq),
    INDEX idx_chat_created (chat_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"@
    Add-Content -Path $outputFile -Value $messagesTable -Encoding UTF8
    Add-Content -Path $outputFile -Value "`n;" -Encoding UTF8
}
else {
    Write-Warning "Base schema full_schema_v2.sql not found!"
}

# 2. Add Migrations
foreach ($file in $files) {
    if ($file.Name -like "*full_schema*") {
        Write-Host "Skipping snapshot: $($file.Name)"
        continue
    }
    
    # FILTER: Skip Partitioning for Shared Hosting (MySQL Restrictions on TIMESTAMP)
    if ($file.Name -like "*041_audit_log_partitioning*") {
        Write-Host "Skipping Partitioning (Hostinger Compat): $($file.Name)"
        continue
    }

    Write-Host "Merging: $($file.Name)"
    $content = Get-Content -Path $file.FullName -Raw
    $separator = "`n`n-- `n-- SOURCE: $($file.Name)`n-- `n`n"
    
    Add-Content -Path $outputFile -Value $separator -Encoding UTF8
    Add-Content -Path $outputFile -Value $content -Encoding UTF8
    Add-Content -Path $outputFile -Value "`n;" -Encoding UTF8
}

Write-Host "`n✅ Successfully generated: latest_schema_complete.sql"
