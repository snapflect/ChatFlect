import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({
    providedIn: 'root'
})
export class LoggingService {

    constructor(private api: ApiService) { }

    log(message: string, ...details: any[]) {
        console.log(`%c[APP Info]`, 'color: blue; font-weight: bold', message, ...details);
        this.sendToBackend('INFO', message, details);
    }

    warn(message: string, ...details: any[]) {
        console.warn(`%c[APP Warn]`, 'color: orange; font-weight: bold', message, ...details);
        this.sendToBackend('WARN', message, details);
    }

    error(message: string, error?: any) {
        console.error(`%c[APP Error]`, 'color: red; font-weight: bold', message, error);

        // Format error object safely
        let errorDetails = error;
        if (error instanceof Error) {
            errorDetails = {
                message: error.message,
                stack: error.stack,
                name: error.name
            };
        }

        this.sendToBackend('ERROR', message, errorDetails);
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
                error: (err) => console.error('Failed to send log', err) // Fallback to console
            });
        } catch (e) {
            console.error('Logging Error', e);
        }
    }
}
