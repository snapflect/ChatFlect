<?php
/**
 * Email Service using PHPMailer for SMTP-based email delivery
 * 
 * Provides fast, reliable email delivery using Hostinger SMTP.
 */

// Autoload PHPMailer - vendor folder is at same level as api folder (public_html/vendor)
require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class EmailService
{
    private static $config = null;
    private static $mailer = null;

    /**
     * Load configuration
     */
    private static function getConfig()
    {
        if (self::$config === null) {
            self::$config = require __DIR__ . '/email_config.php';
        }
        return self::$config;
    }

    /**
     * Get or create PHPMailer instance
     */
    private static function getMailer()
    {
        if (self::$mailer === null) {
            $config = self::getConfig();

            self::$mailer = new PHPMailer(true);

            // SMTP Configuration
            self::$mailer->isSMTP();
            self::$mailer->Host = $config['smtp_host'];
            self::$mailer->Port = $config['smtp_port'];
            self::$mailer->SMTPSecure = $config['smtp_secure'];
            self::$mailer->SMTPAuth = true;
            self::$mailer->Username = $config['smtp_username'];
            self::$mailer->Password = $config['smtp_password'];

            // Sender info
            self::$mailer->setFrom($config['from_email'], $config['from_name']);

            // Timeout settings for faster delivery
            self::$mailer->Timeout = 10;
            self::$mailer->SMTPKeepAlive = true;
        }

        return self::$mailer;
    }

    /**
     * Send OTP email
     * 
     * @param string $to Recipient email address
     * @param string $otp The OTP code
     * @return array ['success' => bool, 'message' => string]
     */
    public static function sendOTP($to, $otp)
    {
        try {
            $mailer = self::getMailer();

            // Clear previous recipients
            $mailer->clearAddresses();
            $mailer->addAddress($to);

            // Email content
            $mailer->Subject = 'Your SnapFlect Login Code';

            // HTML version
            $mailer->isHTML(true);
            $mailer->Body = self::getOTPEmailHTML($otp);

            // Plain text version
            $mailer->AltBody = "Your SnapFlect verification code is: $otp\n\nThis code expires in 5 minutes.\n\nIf you didn't request this code, please ignore this email.";

            $mailer->send();

            error_log("OTP email sent successfully to: $to");
            return ['success' => true, 'message' => 'OTP sent successfully'];

        } catch (Exception $e) {
            error_log("Failed to send OTP email to $to: " . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to send email: ' . $e->getMessage()];
        }
    }

    /**
     * Generate HTML email template for OTP
     */
    private static function getOTPEmailHTML($otp)
    {
        return '
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px 10px 0 0;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 28px;">SnapFlect</h1>
                                </td>
                            </tr>
                            <!-- Body -->
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px;">Your Verification Code</h2>
                                    <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.5;">
                                        Use the following code to log in to your SnapFlect account:
                                    </p>
                                    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
                                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea;">' . $otp . '</span>
                                    </div>
                                    <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">
                                        ⏱️ This code expires in <strong>5 minutes</strong>.
                                    </p>
                                    <p style="margin: 0; color: #999999; font-size: 13px;">
                                        If you didn\'t request this code, you can safely ignore this email.
                                    </p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 20px 30px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 10px 10px;">
                                    <p style="margin: 0; color: #999999; font-size: 12px;">
                                        © 2025 SnapFlect. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>';
    }

    /**
     * Close SMTP connection
     */
    public static function close()
    {
        if (self::$mailer !== null) {
            self::$mailer->smtpClose();
            self::$mailer = null;
        }
    }
}
?>