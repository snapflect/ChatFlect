import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable } from 'rxjs';
import { filter, take, map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class AutoLoginGuard implements CanActivate {
    constructor(private auth: AuthService, private router: Router) { }

    canActivate(): Observable<boolean | UrlTree> {
        const { from, of } = require('rxjs');
        const { switchMap } = require('rxjs/operators');

        return this.auth.currentUserId.pipe(
            filter(val => val !== null || val === null), // Trigger
            take(1),
            switchMap((userId: string | null) => {
                if (userId) {
                    // User is logged in, check profile
                    return from(this.auth.isProfileComplete().then(isComplete => {
                        if (isComplete) {
                            return this.router.parseUrl('/tabs/chats');
                        } else {
                            // Force profile setup
                            return this.router.parseUrl('/profile');
                        }
                    }));
                } else {
                    // Allow access to Login page
                    return of(true);
                }
            })
        );
    }
}
