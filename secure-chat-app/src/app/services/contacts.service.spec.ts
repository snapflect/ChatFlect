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

    it('should use local name fallback when server name is missing', async () => {
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
        spyOn(Contacts, 'requestPermissions').and.returnValue(Promise.resolve({ contacts: 'granted' } as any));

        const mockLocal = {
            contacts: [
                {
                    displayName: 'Local Friend',
                    phones: [{ number: '1234567890' }]
                }
            ]
        };
        spyOn(Contacts, 'getContacts').and.returnValue(Promise.resolve(mockLocal as any));

        // Mock Server Response (Empty Profile)
        const mockServerRes = [{
            user_id: 'u1',
            phone_number: '1234567890',
            first_name: null
        }];
        apiSpy.post.and.returnValue(of(mockServerRes));

        const result = await service.getContacts() as any[];

        expect(result.length).toBe(1);
        expect(result[0].localName).toBe('Local Friend');
    });

    it('should merge photo_url from server', async () => {
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
        spyOn(Contacts, 'requestPermissions').and.returnValue(Promise.resolve({ contacts: 'granted' } as any));
        spyOn(Contacts, 'getContacts').and.returnValue(Promise.resolve({ contacts: [] } as any));

        const mockServerRes = [{
            user_id: 'u2',
            phone_number: '9999999999',
            first_name: 'Server Name',
            photo_url: 'http://pic.com/1.jpg'
        }];
        apiSpy.post.and.returnValue(of(mockServerRes));

        const result = await service.getContacts() as any[];

        expect(result.length).toBe(1);
        expect(result[0].photo_url).toBe('http://pic.com/1.jpg');
        expect(result[0].first_name).toBe('Server Name');
    });

    it('should handle errors in getContacts gracefully', async () => {
        spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
        spyOn(Contacts, 'requestPermissions').and.returnValue(Promise.reject('Boom'));

        const result = await service.getContacts() as any[];
        expect(result.length).toBe(0); // Should return empty array on error
        expect(loggerSpy.error).toHaveBeenCalled();
    });
});
