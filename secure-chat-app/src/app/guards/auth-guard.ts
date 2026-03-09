import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { AppInitService } from '../services/app-init.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
    private appInit: AppInitService
  ) { }

  canActivate(): Observable<boolean | UrlTree> {
    return this.appInit.initialized$.pipe(
      filter(init => init === true),
      take(1),
      map(() => {
        if (this.auth.isAuthenticated()) {
          return true;
        } else {
          return this.router.parseUrl('/login');
        }
      })
    );
  }
}
