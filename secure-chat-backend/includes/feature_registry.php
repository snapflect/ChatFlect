<?php
// includes/feature_registry.php
// Epic 68: Feature Registry

class FeatureRegistry
{
    // Canonical List of Features
    const FEATURES = [
        'BASIC_CHAT' => 'Core Messaging',
        'SSO' => 'Single Sign-On',
        'SCIM' => 'User Provisioning',
        'EXPORTS' => 'Data Exports',
        'AUDIT_LOGS' => 'Audit Logging',
        'RETENTION' => 'Custom Retention Policies'
    ];

    public static function isValid($key)
    {
        return array_key_exists($key, self::FEATURES);
    }
}
