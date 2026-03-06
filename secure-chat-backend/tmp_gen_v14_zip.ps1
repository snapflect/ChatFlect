$source = 'd:\Mubarak\SnapFlectMobileWebApp\ChatFlect\ChatFlect\secure-chat-backend'
$zipPath = "$source\backend_v14_final_schema_repaired.zip"

if (Test-Path $zipPath) { 
    Remove-Item $zipPath -Force 
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$folders = @('api', 'includes', 'relay', 'admin', 'migrations', 'config', 'cron', 'db', 'docs', 'logs', 'scripts')
$rootFiles = @('.htaccess', 'index.php', 'ping.php', 'fix_blocking.php', 'latest_schema_complete.sql', 'README.md')

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')

try {
    # Add folders recursively
    foreach ($folder in $folders) {
        $folderPath = Join-Path $source $folder
        if (Test-Path $folderPath) {
            $files = Get-ChildItem -Path $folderPath -Recurse -File
            foreach ($file in $files) {
                # Calculate relative path
                $relativePath = $file.FullName.Substring($source.Length + 1).Replace('\', '/')
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relativePath)
            }
        }
    }

    # Add root files
    foreach ($fileName in $rootFiles) {
        $filePath = Join-Path $source $fileName
        if (Test-Path $filePath) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $filePath, $fileName)
        }
    }
}
finally {
    if ($null -ne $zip) {
        $zip.Dispose()
    }
}

if (Test-Path $zipPath) {
    Write-Host "V14 Repaired ZIP generated successfully at $zipPath"
}
else {
    Write-Host "FAILED to generate ZIP at $zipPath"
    exit 1
}
