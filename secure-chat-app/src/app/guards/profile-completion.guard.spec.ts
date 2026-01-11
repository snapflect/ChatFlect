import { TestBed } from '@angular/core/testing';
import { ProfileCompletionGuard } from './profile-completion.guard';
import { AuthService } from '../services/auth.service';
import { Router, UrlTree } from '@angular/router';

describe('ProfileCompletionGuard', () => {
    let guard: ProfileCompletionGuard;
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(() => {
        authServiceSpy = jasmine.createSpyObj('AuthService', ['isProfileComplete']);
        routerSpy = jasmine.createSpyObj('Router', ['parseUrl']);
        routerSpy.parseUrl.and.callFake(url => url as any as UrlTree);

        TestBed.configureTestingModule({
            providers: [
                ProfileCompletionGuard,
                { provide: AuthService, useValue: authServiceSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });
        guard = TestBed.inject(ProfileCompletionGuard);
    });

    it('should be created', () => {
        expect(guard).toBeTruthy();
    });

    it('should allow navigation if profile is complete', async () => {
        authServiceSpy.isProfileComplete.and.returnValue(Promise.resolve(true));
        const res = await guard.canActivate();
        expect(res).toBeTrue();
    });

    it('should redirect to profile if profile is incomplete', async () => {
        authServiceSpy.isProfileComplete.and.returnValue(Promise.resolve(false));
        const res = await guard.canActivate();
        expect(routerSpy.parseUrl).toHaveBeenCalledWith('/profile');
    });
});
