import { TestBed } from '@angular/core/testing';
import { RecordingService } from './recording.service';
import { LoggingService } from './logging.service';
import { VoiceRecorder } from 'capacitor-voice-recorder';

describe('RecordingService', () => {
    let service: RecordingService;
    let loggerSpy: jasmine.SpyObj<LoggingService>;

    beforeEach(() => {
        loggerSpy = jasmine.createSpyObj('LoggingService', ['error']);

        TestBed.configureTestingModule({
            providers: [
                RecordingService,
                { provide: LoggingService, useValue: loggerSpy }
            ]
        });
        service = TestBed.inject(RecordingService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should check recording support', async () => {
        const implementation = () => Promise.resolve({ value: true });
        let spy: jasmine.Spy;
        if (jasmine.isSpy(VoiceRecorder.canDeviceVoiceRecord)) {
            spy = VoiceRecorder.canDeviceVoiceRecord as jasmine.Spy;
            spy.and.callFake(implementation);
        } else {
            try {
                spy = spyOn(VoiceRecorder, 'canDeviceVoiceRecord').and.callFake(implementation);
            } catch (e) {
                spy = jasmine.createSpy('canDeviceVoiceRecord').and.callFake(implementation);
                try {
                    Object.defineProperty(VoiceRecorder, 'canDeviceVoiceRecord', { value: spy, configurable: true, writable: true });
                } catch (e2) {
                    (VoiceRecorder as any).canDeviceVoiceRecord = spy;
                }
            }
        }
        const res = await service.canRecord();
        expect(res.value).toBeTrue();
    });

    it('should check recording permission', async () => {
        const implementation = () => Promise.resolve({ value: true });
        let spy: jasmine.Spy;
        if (jasmine.isSpy(VoiceRecorder.hasAudioRecordingPermission)) {
            spy = VoiceRecorder.hasAudioRecordingPermission as jasmine.Spy;
            spy.and.callFake(implementation);
        } else {
            try {
                spy = spyOn(VoiceRecorder, 'hasAudioRecordingPermission').and.callFake(implementation);
            } catch (e) {
                spy = jasmine.createSpy('hasAudioRecordingPermission').and.callFake(implementation);
                try {
                    Object.defineProperty(VoiceRecorder, 'hasAudioRecordingPermission', { value: spy, configurable: true, writable: true });
                } catch (e2) {
                    (VoiceRecorder as any).hasAudioRecordingPermission = spy;
                }
            }
        }
        const res = await service.hasPermission();
        expect(res).toBeTrue();
    });

    it('should start recording', async () => {
        const implementation = () => Promise.resolve({ value: true });
        let spy: jasmine.Spy;
        if (jasmine.isSpy(VoiceRecorder.startRecording)) {
            spy = VoiceRecorder.startRecording as jasmine.Spy;
            spy.and.callFake(implementation);
        } else {
            try {
                spy = spyOn(VoiceRecorder, 'startRecording').and.callFake(implementation);
            } catch (e) {
                spy = jasmine.createSpy('startRecording').and.callFake(implementation);
                try {
                    Object.defineProperty(VoiceRecorder, 'startRecording', { value: spy, configurable: true, writable: true });
                } catch (e2) {
                    (VoiceRecorder as any).startRecording = spy;
                }
            }
        }
        await service.startRecording();
        expect(spy).toHaveBeenCalled();
    });

    it('should stop recording and return data', async () => {
        const mockResult = { value: { recordDataBase64: 'base64str', msDuration: 1000, mimeType: 'audio/aac' } };
        const implementation = () => Promise.resolve(mockResult);
        let spy: jasmine.Spy;
        if (jasmine.isSpy(VoiceRecorder.stopRecording)) {
            spy = VoiceRecorder.stopRecording as jasmine.Spy;
            spy.and.callFake(implementation);
        } else {
            try {
                spy = spyOn(VoiceRecorder, 'stopRecording').and.callFake(implementation);
            } catch (e) {
                spy = jasmine.createSpy('stopRecording').and.callFake(implementation);
                try {
                    Object.defineProperty(VoiceRecorder, 'stopRecording', { value: spy, configurable: true, writable: true });
                } catch (e2) {
                    (VoiceRecorder as any).stopRecording = spy;
                }
            }
        }
        const res = await service.stopRecording();
        expect(res).toEqual(mockResult);
    });
});
