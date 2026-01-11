import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CallModalPage } from './call-modal.page';
import { IonicModule, ModalController, NavParams } from '@ionic/angular';
import { CallService } from 'src/app/services/call.service';
import { LoggingService } from 'src/app/services/logging.service';
import { BehaviorSubject, of } from 'rxjs';

describe('CallModalPage', () => {
    let component: CallModalPage;
    let fixture: ComponentFixture<CallModalPage>;
    let callServiceSpy: jasmine.SpyObj<CallService>;
    let modalCtrlSpy: jasmine.SpyObj<ModalController>;
    let navParamsSpy: jasmine.SpyObj<NavParams>;

    beforeEach(async () => {
        callServiceSpy = jasmine.createSpyObj('CallService', ['answerCall', 'endCall', 'toggleAudio', 'toggleVideo', 'switchCamera'], {
            remoteStreams: new BehaviorSubject(new Map()),
            localStream: new BehaviorSubject(null),
            callStatus: new BehaviorSubject('idle'),
            incomingCallData: null
        });
        modalCtrlSpy = jasmine.createSpyObj('ModalController', ['dismiss']);
        navParamsSpy = jasmine.createSpyObj('NavParams', ['get']);
        navParamsSpy.get.and.callFake((key: string): any => {
            if (key === 'status') return 'incoming';
            if (key === 'callerName') return 'Test User';
            return null;
        });

        await TestBed.configureTestingModule({
            declarations: [CallModalPage],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: CallService, useValue: callServiceSpy },
                { provide: ModalController, useValue: modalCtrlSpy },
                { provide: NavParams, useValue: navParamsSpy },
                { provide: LoggingService, useValue: jasmine.createSpyObj('LoggingService', ['log', 'error']) }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(CallModalPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should display caller name from navParams', () => {
        expect(component.callerName).toBe('Test User');
        expect(component.status).toBe('incoming');
    });

    it('should answer call', () => {
        component.answer();
        expect(callServiceSpy.answerCall).toHaveBeenCalled();
        expect(component.status).toBe('connected');
    });

    it('should hangup call', () => {
        component.hangup();
        expect(callServiceSpy.endCall).toHaveBeenCalled();
        expect(modalCtrlSpy.dismiss).toHaveBeenCalled();
    });

    it('should toggle mute', () => {
        component.toggleMute();
        expect(component.isMuted).toBeTrue();
        expect(callServiceSpy.toggleAudio).toHaveBeenCalledWith(false);
    });

    it('should dismiss when call status becomes idle', () => {
        (callServiceSpy.callStatus as BehaviorSubject<string>).next('idle');
        expect(modalCtrlSpy.dismiss).toHaveBeenCalled();
    });
});
