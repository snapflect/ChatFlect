import { TestBed } from '@angular/core/testing';
import { ProfileService } from './profile.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { LoggingService } from './logging.service';
import * as Firestore from 'firebase/firestore';

describe('ProfileService', () => {
    let service: ProfileService;
    let apiSpy: jasmine.SpyObj<ApiService>;
    let authSpy: jasmine.SpyObj<AuthService>;
    let loggerSpy: jasmine.SpyObj<LoggingService>;

    beforeEach(() => {
        const api = jasmine.createSpyObj('ApiService', ['get', 'post']);
        const auth = jasmine.createSpyObj('AuthService', [], { currentUserId: 'test_id' });
        const logger = jasmine.createSpyObj('LoggingService', ['log', 'error']);

        TestBed.configureTestingModule({
            providers: [
                ProfileService,
                { provide: ApiService, useValue: api },
                { provide: AuthService, useValue: auth },
                { provide: LoggingService, useValue: logger }
            ]
        });

        service = TestBed.inject(ProfileService);
        apiSpy = TestBed.inject(ApiService) as jasmine.SpyObj<ApiService>;
        authSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
        loggerSpy = TestBed.inject(LoggingService) as jasmine.SpyObj<LoggingService>;

        spyOn(localStorage, 'getItem').and.returnValue('test_id');
    });

    it('should fall back to Firestore if API returns incomplete profile', async () => {
        // Mock API returning incomplete data
        const incompleteProfile = { user_id: 'test_id', first_name: '' };
        apiSpy.get.and.returnValue({ toPromise: () => Promise.resolve(incompleteProfile) } as any);

        // Mock Firestore helpers
        const firestoreProfile = { first_name: 'FirestoreName', last_name: 'Fallback' };
        const mockDocSnap = {
            exists: () => true,
            data: () => firestoreProfile
        };

        const getDocSpy = spyOn(service as any, 'firestoreGetDoc').and.returnValue(Promise.resolve(mockDocSnap));
        spyOn(service as any, 'firestoreGetInstance').and.returnValue({});
        spyOn(service as any, 'firestoreDoc').and.returnValue({});

        const result = await service.getProfile();

        expect(result).toEqual(jasmine.objectContaining({ first_name: 'FirestoreName' }));
        expect(getDocSpy).toHaveBeenCalled();
    });

    it('should use API data if complete', async () => {
        const completeProfile = { user_id: 'test_id', first_name: 'ApiName' };
        apiSpy.get.and.returnValue({ toPromise: () => Promise.resolve(completeProfile) } as any);

        const getDocSpy = spyOn(service as any, 'firestoreGetDoc');

        const result = await service.getProfile();

        expect(result.first_name).toBe('ApiName');
        expect(getDocSpy).not.toHaveBeenCalled();
    });
});
