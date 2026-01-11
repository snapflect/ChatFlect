import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { GroupCallPage } from './group-call.page';
import { CallService } from 'src/app/services/call.service';
import { NavController, IonicModule } from '@ionic/angular';
import { BehaviorSubject, of } from 'rxjs';

describe('GroupCallPage', () => {
  let component: GroupCallPage;
  let fixture: ComponentFixture<GroupCallPage>;
  let callServiceSpy: jasmine.SpyObj<CallService>;
  let navCtrlSpy: jasmine.SpyObj<NavController>;

  beforeEach(async () => {
    callServiceSpy = jasmine.createSpyObj('CallService', ['toggleAudio', 'toggleSpeaker', 'toggleHold', 'toggleVideo', 'switchCamera', 'endCall', 'getCallerInfo'], {
      localStream: new BehaviorSubject(null),
      remoteStreams: new BehaviorSubject(new Map()),
      callStatus: new BehaviorSubject('idle'),
      isOnHold: new BehaviorSubject(false),
      activeCallType: 'audio'
    });
    navCtrlSpy = jasmine.createSpyObj('NavController', ['navigateBack', 'back']);

    await TestBed.configureTestingModule({
      declarations: [GroupCallPage],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: CallService, useValue: callServiceSpy },
        { provide: NavController, useValue: navCtrlSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GroupCallPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle mic', () => {
    component.toggleMic();
    expect(component.micEnabled).toBeFalse();
    expect(callServiceSpy.toggleAudio).toHaveBeenCalledWith(false);
  });

  it('should toggle speaker', () => {
    component.toggleSpeaker();
    expect(component.speakerEnabled).toBeTrue();
    expect(callServiceSpy.toggleSpeaker).toHaveBeenCalledWith(true);
  });

  it('should start timer when status becomes connected', fakeAsync(() => {
    (callServiceSpy.callStatus as BehaviorSubject<string>).next('connected');
    tick(1000);
    expect(component.callDuration).toBe('00:01');
    component.ngOnDestroy();
  }));

  it('should navigate back when status becomes idle', () => {
    (callServiceSpy.callStatus as BehaviorSubject<string>).next('idle');
    expect(navCtrlSpy.navigateBack).toHaveBeenCalledWith('/tabs/chats');
  });

  it('should end call and go back', () => {
    component.endCall();
    expect(callServiceSpy.endCall).toHaveBeenCalled();
    expect(navCtrlSpy.back).toHaveBeenCalled();
  });
});
