import { TestBed } from '@angular/core/testing';
import { PushService } from './push.service';
import { ApiService } from './api.service';
import { Platform } from '@ionic/angular';
import { LoggingService } from './logging.service';
import { of } from 'rxjs';
import { PushNotifications } from '@capacitor/push-notifications';

describe('PushService', () => {
    let service: PushService;
    let apiSpy: jasmine.SpyObj<ApiService>;
    let platformSpy: jasmine.SpyObj<Platform>;
    let loggerSpy: jasmine.SpyObj<LoggingService>;

    beforeEach(() => {
        apiSpy = jasmine.createSpyObj('ApiService', ['post']);
        platformSpy = jasmine.createSpyObj('Platform', ['is']);
        loggerSpy = jasmine.createSpyObj('LoggingService', ['error', 'log']);

        TestBed.configureTestingModule({
            providers: [
                PushService,
                { provide: ApiService, useValue: apiSpy },
                { provide: Platform, useValue: platformSpy },
                { provide: LoggingService, useValue: loggerSpy }
            ]
        });
        service = TestBed.inject(PushService);

        spyOn(localStorage, 'getItem').and.returnValue('my_id');
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should initialize native push if on capacitor', async () => {
        platformSpy.is.and.returnValue(true);
        const permImpl = () => Promise.resolve({ receive: 'granted' } as any);
        const regImpl = () => Promise.resolve();

        const permSpy = spyOn(PushNotifications, 'checkPermissions').and.returnValue(Promise.resolve({ receive: 'granted' } as any));
        const regSpy = spyOn(PushNotifications, 'register').and.returnValue(Promise.resolve());

        await service.initPush();
        expect(regSpy).toHaveBeenCalled();

    });

    it('should save token to backend', async () => {
        apiSpy.post.and.returnValue(of({}));
        await service.saveToken('token123');
        expect(apiSpy.post).toHaveBeenCalledWith('register.php', jasmine.objectContaining({
            action: 'update_token',
            fcm_token: 'token123'
        }));
    });

    it('should send a push notification', async () => {
        apiSpy.post.and.returnValue(of({}));
        await service.sendPush('target1', 'title', 'body', { type: 'chat' });
        expect(apiSpy.post).toHaveBeenCalledWith('push.php', jasmine.objectContaining({
            target_user_id: 'target1',
            title: 'title',
            body: 'body'
        }));
    });
});
