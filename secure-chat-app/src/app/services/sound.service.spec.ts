import { TestBed } from '@angular/core/testing';
import { SoundService } from './sound.service';
import { LoggingService } from './logging.service';
import { Haptics } from '@capacitor/haptics';

describe('SoundService', () => {
    let service: SoundService;
    let loggerSpy: jasmine.SpyObj<LoggingService>;

    beforeEach(() => {
        loggerSpy = jasmine.createSpyObj('LoggingService', ['log', 'error']);

        // Mock Audio
        const mockAudio = {
            play: () => Promise.resolve(),
            pause: () => { },
            currentTime: 0,
            loop: false,
            src: '',
            onerror: null
        } as any;

        spyOn(window, 'Audio').and.returnValue(mockAudio);

        TestBed.configureTestingModule({
            providers: [
                SoundService,
                { provide: LoggingService, useValue: loggerSpy }
            ]
        });
        service = TestBed.inject(SoundService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should play and stop ringtone', () => {
        const audio = (service as any).ringtoneAudio;
        spyOn(audio, 'play').and.returnValue(Promise.resolve());
        spyOn(audio, 'pause');

        service.playRingtone();
        expect(audio.play).toHaveBeenCalled();
        expect((service as any).isRingtonePlaying).toBeTrue();

        service.stopRingtone();
        expect(audio.pause).toHaveBeenCalled();
        expect((service as any).isRingtonePlaying).toBeFalse();
    });

    it('should play message sound if chat is not active', () => {
        const audio = (service as any).messageAudio;
        spyOn(audio, 'play').and.returnValue(Promise.resolve());

        service.setActiveChat('chat1');
        service.playMessageSound('chat2');

        expect(audio.play).toHaveBeenCalled();
    });

    it('should skip message sound if chat is active', () => {
        const audio = (service as any).messageAudio;
        spyOn(audio, 'play').and.returnValue(Promise.resolve());

        service.setActiveChat('chat1');
        service.playMessageSound('chat1');

        expect(audio.play).not.toHaveBeenCalled();
    });

    it('should vibrate for message', async () => {
        const hapticsSpy = spyOn(Haptics, 'notification').and.returnValue(Promise.resolve());
        await (service as any).vibrateForMessage();
        expect(hapticsSpy).toHaveBeenCalled();
    });
});
