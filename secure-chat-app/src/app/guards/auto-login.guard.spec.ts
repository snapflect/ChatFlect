import { TestBed } from '@angular/core/testing';
import { AutoLoginGuard } from './auto-login.guard';
import { AuthService } from '../services/auth.service';
import { Router, UrlTree } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';

describe('AutoLoginGuard', () => {
    let guard: AutoLoginGuard;
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(() => {
        authServiceSpy = jasmine.createSpyObj('AuthService', ['isProfileComplete'], {
            currentUserId: new BehaviorSubject<string | null>(null)
        });
        routerSpy = jasmine.createSpyObj('Router', ['parseUrl']);
        routerSpy.parseUrl.and.callFake(url => url as any as UrlTree);

        TestBed.configureTestingModule({
            providers: [
                AutoLoginGuard,
                { provide: AuthService, useValue: authServiceSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });
        guard = TestBed.inject(AutoLoginGuard);
    });

    it('should be created', () => {
        expect(guard).toBeTruthy();
    });

    it('should allow true if no user is logged in (to let them access login page)', (done) => {
        (authServiceSpy.currentUserId as BehaviorSubject<string | null>).next(null);
        guard.canActivate().subscribe(res => {
            expect(res).toBeTrue();
            done();
        });
    });

    it('should redirect to tabs/chats if user is logged in and profile is complete', (done) => {
        (authServiceSpy.currentUserId as BehaviorSubject<string | null>).next('my_id');
        authServiceSpy.isProfileComplete.and.returnValue(Promise.resolve(true));

        guard.canActivate().subscribe(res => {
            expect(routerSpy.parseUrl).toHaveBeenCalledWith('/tabs/chats');
            done();
        });
    });

    it('should redirect to profile if user is logged in but profile is incomplete', (done) => {
        (authServiceSpy.currentUserId as BehaviorSubject<string | null>).next('my_id');
        authServiceSpy.isProfileComplete.and.returnValue(Promise.resolve(false));

        guard.canActivate().subscribe(res => {
            expect(routerSpy.parseUrl).toHaveBeenCalledWith('/profile');
            done();
        });
    });
});
