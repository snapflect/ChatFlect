import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({
    providedIn: 'root'
})
export class LoggingService {
    // Audit-grade Blacklist (HF-2.5)
    private readonly SENSITIVE_KEYS = ['ciphertext', 'key', 'seed', 'salt', 'passphrase', 'private_key', 'payload', 'k', 'i', 'h', 's', 'signature', 'mac'];
    private readonly ID_PATTERN = /^(user|chat|msg|device)_[a-z0-9-_]+$/i;

    constructor(private api: ApiService) { }

    log(message: string, ...details: any[]) {
        const safeDetails = details.map(d => this.maskPII(d));
        console.log(`%c[APP Info]`, 'color: blue; font-weight: bold', message, ...safeDetails);
        this.sendToBackend('INFO', message, safeDetails);
    }

    warn(message: string, ...details: any[]) {
        const safeDetails = details.map(d => this.maskPII(d));
        console.warn(`%c[APP Warn]`, 'color: orange; font-weight: bold', message, ...safeDetails);
        this.sendToBackend('WARN', message, safeDetails);
    }

    error(message: string, error?: any) {
        const safeError = this.maskPII(error);
        console.error(`%c[APP Error]`, 'color: red; font-weight: bold', message, safeError);

        // Format error object safely
        let errorDetails = safeError;
        if (error instanceof Error) {
            errorDetails = {
                message: this.maskPII(error.message),
                stack: '[Redacted Stack]', // Stack traces often leak local paths/identifiers
                name: error.name
            };
        }

        this.sendToBackend('ERROR', message, errorDetails);
    }

    /**
     * HF-2.5 Recursive Masking Utility
     */
    private maskPII(data: any): any {
        if (data === null || data === undefined) return data;

        if (typeof data === 'string') {
            // Mask IDs
            if (this.ID_PATTERN.test(data)) {
                return data.substring(0, 8) + '***';
            }
            // Block Base64 blobs that look like keys/ciphertext (high entropy)
            if (data.length > 50 && !data.includes(' ')) {
                return '[HIGH_ENTROPY_BLOCK]';
            }
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(item => this.maskPII(item));
        }

        if (typeof data === 'object') {
            const masked: any = {};
            for (const key in data) {
                if (this.SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk))) {
                    masked[key] = '[REDACTED_SENSITIVE]';
                } else {
                    masked[key] = this.maskPII(data[key]);
                }
            }
            return masked;
        }

        return data;
    }

    private sendToBackend(level: string, message: string, context: any) {
        // Simple fire-and-forget, avoiding infinite loops if API fails
        try {
            this.api.post('log_error.php', {
                level: level,
                message: message,
                context: context,
                timestamp: new Date().toISOString()
            }).subscribe({
                next: () => { },
                error: (err) => {
                    // Fail silently to prevent recursion/looping
                }
            });
        } catch (e) {
            // Silently discard logging errors
        }
    }
}
