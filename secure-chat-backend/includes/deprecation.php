<?php
// includes/deprecation.php
// Epic 34: API Versioning + Deprecation Framework

/**
 * Add API version header.
 */
function addVersionHeader($version = 'v1')
{
    header("X-API-Version: $version");
}

/**
 * Add deprecation headers for sunset endpoints.
 */
function addDeprecationHeaders($sunsetDate, $replacementUrl = null)
{
    header("Deprecation: true");
    header("Sunset: $sunsetDate");
    if ($replacementUrl) {
        header("Link: <$replacementUrl>; rel=\"successor-version\"");
    }
}

/**
 * Check if endpoint is deprecated and add headers.
 */
function checkDeprecation($endpoint)
{
    $deprecated = getDeprecatedEndpoints();

    if (isset($deprecated[$endpoint])) {
        $info = $deprecated[$endpoint];
        if ($info['deprecated'] ?? false) {
            addDeprecationHeaders(
                $info['sunset'] ?? '',
                $info['replacement'] ?? null
            );
            return true;
        }
    }
    return false;
}

/**
 * Get deprecated endpoints registry.
 */
function getDeprecatedEndpoints()
{
    static $endpoints = null;
    if ($endpoints === null) {
        $file = __DIR__ . '/../config/deprecated_endpoints.php';
        $endpoints = file_exists($file) ? require $file : [];
    }
    return $endpoints;
}

/**
 * Detect API version from request path.
 */
function detectApiVersion($path)
{
    if (preg_match('#/v(\d+)/#', $path, $matches)) {
        return 'v' . $matches[1];
    }
    // Default version for unversioned endpoints
    return 'v1';
}

/**
 * Apply version and deprecation headers for current request.
 */
function applyVersionHeaders()
{
    $path = $_SERVER['REQUEST_URI'] ?? '';
    $version = detectApiVersion($path);

    addVersionHeader($version);
    checkDeprecation($path);
}
