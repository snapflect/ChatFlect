import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({
    providedIn: 'root'
})
export class LoggingService {

    constructor(private api: ApiService) { }

    log(message: string, ...details: any[]) {
        console.log(`%c[APP Info]`, 'color: blue; font-weight: bold', message, ...details);
    }

    warn(message: string, ...details: any[]) {
        console.warn(`%c[APP Warn]`, 'color: orange; font-weight: bold', message, ...details);
    }

    error(message: string, error?: any) {
        console.error(`%c[APP Error]`, 'color: red; font-weight: bold', message, error);

        // Optional: Send to Backend
        // this.api.post('log_error.php', { msg: message, stack: error?.stack }).subscribe();
    }
}
