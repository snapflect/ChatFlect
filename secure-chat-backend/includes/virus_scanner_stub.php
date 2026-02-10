<?php
// includes/virus_scanner_stub.php
// Epic 75 HF: Virus Scanner Interface

class VirusScannerStub
{
    public static function scan($filePath)
    {
        // Mock Scan
        // In prod, integration with ClamAV or external API
        // Return true if safe, false if malware

        // Simulating 1% malware detection
        // if (rand(1, 100) == 1) return false;

        return true;
    }
}
