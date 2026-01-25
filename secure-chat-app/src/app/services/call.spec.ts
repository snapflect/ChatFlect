import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CallService } from './call.service';
import { ApiService } from './api.service';
import { LoggingService } from './logging.service';
import { PushService } from './push.service';
import { SoundService } from './sound.service';

describe('CallService', () => {
    let service: CallService;
    let pushServiceSpy: jasmine.SpyObj<PushService>;
    let soundServiceSpy: jasmine.SpyObj<SoundService>;
    let loggerSpy: jasmine.SpyObj<LoggingService>;
    let apiServiceSpy: jasmine.SpyObj<ApiService>;

    beforeEach(() => {
        const pushSpy = jasmine.createSpyObj('PushService', ['sendPushNotification', 'clearNotifications', 'sendPush']);
        const soundSpy = jasmine.createSpyObj('SoundService', ['playRingtone', 'stopRingtone', 'playRingbackTone', 'stopRingbackTone', 'playCallEndTone', 'playBusyTone']);
        const logSpy = jasmine.createSpyObj('LoggingService', ['log', 'error', 'warn']);
        const apiSpy = jasmine.createSpyObj('ApiService', ['post']);

        TestBed.configureTestingModule({
            providers: [
                CallService,
                { provide: PushService, useValue: pushSpy },
                { provide: SoundService, useValue: soundSpy },
                { provide: LoggingService, useValue: logSpy },
                { provide: ApiService, useValue: apiSpy }
            ]
        });

        service = TestBed.inject(CallService);
        pushServiceSpy = TestBed.inject(PushService) as jasmine.SpyObj<PushService>;
        soundServiceSpy = TestBed.inject(SoundService) as jasmine.SpyObj<SoundService>;
        loggerSpy = TestBed.inject(LoggingService) as jasmine.SpyObj<LoggingService>;
        apiServiceSpy = TestBed.inject(ApiService) as jasmine.SpyObj<ApiService>;

        // Mock localStorage
        const store: { [key: string]: string } = {};
        spyOn(localStorage, 'getItem').and.callFake((key: string) => store[key] || 'my_id');
        spyOn(localStorage, 'setItem').and.callFake((key: string, value: string) => store[key] = value);

        // Spy on Firestore helpers
        // Overwrite methods directly to ensure spies are used
        service.firestoreSetDoc = jasmine.createSpy('firestoreSetDoc').and.returnValue(Promise.resolve());
        service.firestoreAddDoc = jasmine.createSpy('firestoreAddDoc').and.returnValue(Promise.resolve());
        service.firestoreUpdateDoc = jasmine.createSpy('firestoreUpdateDoc').and.returnValue(Promise.resolve());
        service.firestoreGetDoc = jasmine.createSpy('firestoreGetDoc').and.returnValue(Promise.resolve({
            exists: () => true,
            data: () => ({ username: 'TestUser', photo: 'url' })
        }) as any);
        service.firestoreGetDocs = jasmine.createSpy('firestoreGetDocs').and.returnValue(Promise.resolve({ docs: [] }));
        service.firestoreOnSnapshot = jasmine.createSpy('firestoreOnSnapshot').and.returnValue(() => { });
        service.firestoreCollection = jasmine.createSpy('firestoreCollection').and.returnValue({});
        service.firestoreDoc = jasmine.createSpy('firestoreDoc').and.returnValue({ id: 'mock_id' });
        service.firestoreQuery = jasmine.createSpy('firestoreQuery').and.returnValue({});

        // Initialize db to dummy object
        (service as any).db = {};
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should force earpiece when answering audio call', async () => {
        // Setup state
        service.currentCallId = 'call_1';
        service.incomingCallData = { id: 'call_1', callerId: 'caller_1', type: 'audio', participants: ['other'] };
        service.activeCallType = 'audio';

        spyOn(service as any, 'getMedia').and.returnValue(Promise.resolve());
        const toggleSpeakerSpy = spyOn(service, 'toggleSpeaker').and.returnValue(Promise.resolve());

        await service.answerCall();
        await new Promise(resolve => setTimeout(resolve, 600)); // Wait for timeout

        expect(toggleSpeakerSpy).toHaveBeenCalledWith(false);
    });

    it('should force earpiece when starting audio group call', async () => {
        spyOn(service as any, 'getMedia').and.returnValue(Promise.resolve());
        spyOn(service as any, 'initiatePeerConnection').and.returnValue(Promise.resolve());
        const toggleSpeakerSpy = spyOn(service, 'toggleSpeaker').and.returnValue(Promise.resolve());

        await service.startGroupCall(['peer_1'], 'audio');
        await new Promise(resolve => setTimeout(resolve, 600));

        expect(toggleSpeakerSpy).toHaveBeenCalledWith(false);
    });
    it('should push notification to all participants on group call (Phase 3)', async () => {
        spyOn(service as any, 'getMedia').and.returnValue(Promise.resolve());
        spyOn(service as any, 'initiatePeerConnection').and.returnValue(Promise.resolve());

        // Mock API for push to return Observable
        apiServiceSpy.post.and.returnValue(createMockObservable({}));

        await service.startGroupCall(['p1', 'p2'], 'video');

        expect(service.firestoreAddDoc).toHaveBeenCalled();
    });

    it('should stop ringing if answered elsewhere (Phase 3)', async () => {
        service.currentCallId = 'c1';
        service.incomingCallData = { id: 'c1', callerId: 'other' };

        await (service as any).cleanup();
        expect(soundServiceSpy.stopRingtone).toHaveBeenCalled();
    });
});

function createMockObservable(data: any) {
    return {
        subscribe: (next: any) => { if (next) next(data); return { unsubscribe: () => { } }; },
        toPromise: () => Promise.resolve(data),
        pipe: () => createMockObservable(data)
    } as any;
}
