<?php
/**
 * SMTP Email Configuration for Hostinger
 * 
 * This file contains the SMTP settings for sending emails via Hostinger.
 * Keep this file secure and do not commit to public repositories.
 */

return [
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_secure' => 'ssl',
    'smtp_username' => 'official@snapflect.com',
    'smtp_password' => 'NewMubarak123#',
    'from_email' => 'official@snapflect.com',
    'from_name' => 'SnapFlect',

    // Rate limiting settings
    'max_otp_requests_per_period' => 3,
    'rate_limit_period_minutes' => 5,
    'otp_expiry_minutes' => 5
];
?>