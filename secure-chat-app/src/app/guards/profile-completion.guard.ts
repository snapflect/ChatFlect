import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ProfileCompletionGuard implements CanActivate {
    constructor(private auth: AuthService, private router: Router) { }

    async canActivate(): Promise<boolean | UrlTree> {
        // Check if we have profile info locally or need to fetch
        // Simple check: Do we have a first name?
        // We can check localStorage or ask AuthService

        // Ideally AuthService stores the profile in memory or localstorage after login
        // If not, we might need a quick fetch.
        // For now, let's assume if 'user_name' is missing in localStorage, we force profile?
        // Or better, let's strictly rely on AuthService.

        // We can add a method to AuthService to check "isProfileComplete"
        const isComplete = await this.auth.isProfileComplete();
        if (isComplete) {
            return true;
        } else {
            return this.router.parseUrl('/profile');
        }
    }
}
