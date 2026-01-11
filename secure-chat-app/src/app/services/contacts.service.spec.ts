import { TestBed } from '@angular/core/testing';
import { ContactsService } from './contacts.service';
import { ApiService } from './api.service';
import { LoggingService } from './logging.service';
import { of, throwError } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';

describe('ContactsService', () => {
    let service: ContactsService;
    let apiSpy: jasmine.SpyObj<ApiService>;
    let loggerSpy: jasmine.SpyObj<LoggingService>;

    beforeEach(() => {
        apiSpy = jasmine.createSpyObj('ApiService', ['post']);
        loggerSpy = jasmine.createSpyObj('LoggingService', ['error']);

        TestBed.configureTestingModule({
            providers: [
                ContactsService,
                { provide: ApiService, useValue: apiSpy },
                { provide: LoggingService, useValue: loggerSpy }
            ]
        });
        service = TestBed.inject(ContactsService);

        // Mock Window Firestore
        (window as any).firestoreDb = {};

        spyOn(localStorage, 'getItem').and.returnValue('my_id');
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should return mock contacts on non-native platform', async () => {
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
        const mockRes = [{ user_id: '1' }];
        apiSpy.post.and.returnValue(of(mockRes));

        const contacts = await service.getContacts();
        expect(contacts).toEqual(mockRes);
        expect(apiSpy.post).toHaveBeenCalled();
    });

    it('should sync phone numbers and return from API', async () => {
        const phones = ['123', '456'];
        const mockRes = [{ phone: '123' }];
        apiSpy.post.and.returnValue(of(mockRes));

        const result = await service.syncPhone(phones);
        expect(result).toEqual(mockRes);
    });

    it('should handle errors in getContacts gracefully', async () => {
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
        spyOn(Contacts, 'requestPermissions').and.returnValue(Promise.reject('Boom'));

        const result = await service.getContacts();
        expect(result.length).toBe(2); // Fallback demo contacts
        expect(loggerSpy.error).toHaveBeenCalled();
    });
});
