<?php
/**
 * Input Sanitization Utilities
 * Security Enhancement #1/#5: Comprehensive input validation and sanitization
 */

/**
 * Sanitize a string - removes HTML tags, trims whitespace, prevents XSS
 */
function sanitizeString($input, $maxLength = 1000)
{
    if ($input === null)
        return null;

    // Convert to string if not already
    $str = (string) $input;

    // Strip HTML and PHP tags
    $str = strip_tags($str);

    // Trim whitespace
    $str = trim($str);

    // Limit length to prevent DoS
    if (strlen($str) > $maxLength) {
        $str = substr($str, 0, $maxLength);
    }

    // Convert special characters to HTML entities (XSS prevention)
    $str = htmlspecialchars($str, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    return $str;
}

/**
 * Sanitize email - validates format and normalizes
 */
function sanitizeEmail($email)
{
    if ($email === null || $email === '')
        return null;

    $email = trim(strtolower($email));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return null; // Invalid email
    }

    return filter_var($email, FILTER_SANITIZE_EMAIL);
}

/**
 * Sanitize phone number - normalizes to digits only, keeps last 10
 */
function sanitizePhone($phone)
{
    if ($phone === null || $phone === '')
        return null;

    // Remove all non-digit characters
    $digits = preg_replace('/[^0-9]/', '', $phone);

    // Keep last 10 digits for matching
    if (strlen($digits) >= 10) {
        return substr($digits, -10);
    }

    return $digits;
}

/**
 * Sanitize user ID - alphanumeric with underscores and dots only
 */
function sanitizeUserId($userId)
{
    if ($userId === null)
        return null;

    // Only allow alphanumeric, underscores, dots, and hyphens
    return preg_replace('/[^a-zA-Z0-9_.\-]/', '', $userId);
}

/**
 * Sanitize URL - validates and returns null if invalid
 */
function sanitizeUrl($url)
{
    if ($url === null || $url === '')
        return null;

    $url = trim($url);

    // Allow relative paths starting with 'uploads/'
    if (str_starts_with($url, 'uploads/')) {
        // Only allow safe characters in path
        return preg_replace('/[^a-zA-Z0-9_.\-\/]/', '', $url);
    }

    // Validate absolute URLs
    if (filter_var($url, FILTER_VALIDATE_URL)) {
        return filter_var($url, FILTER_SANITIZE_URL);
    }

    return null;
}

/**
 * Sanitize integer - ensures valid non-negative integer
 */
function sanitizeInt($value, $min = 0, $max = PHP_INT_MAX)
{
    $int = filter_var($value, FILTER_VALIDATE_INT);

    if ($int === false)
        return null;

    return max($min, min($max, $int));
}

/**
 * Sanitize JSON string - validates JSON structure
 */
function sanitizeJson($jsonString)
{
    if ($jsonString === null)
        return null;

    $decoded = json_decode($jsonString);

    if (json_last_error() !== JSON_ERROR_NONE) {
        return null;
    }

    return $jsonString;
}
?>