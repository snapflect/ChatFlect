import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { CallService } from './services/call.service';
import { PushService } from './services/push.service';
import { PresenceService } from './services/presence.service';
import { SoundService } from './services/sound.service';
import { ChatService } from './services/chat.service';
import { ModalController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';

describe('AppComponent', () => {
  let callServiceSpy: any;
  let pushServiceSpy: any;
  let chatServiceSpy: any;

  beforeEach(async () => {
    callServiceSpy = jasmine.createSpyObj('CallService', ['init', 'startGroupCall'], {
      callStatus: new BehaviorSubject<string>('idle')
    });
    pushServiceSpy = jasmine.createSpyObj('PushService', ['initPush'], {
      messageSubject: new BehaviorSubject<any>(null)
    });
    chatServiceSpy = jasmine.createSpyObj('ChatService', [], {
      newMessage$: new BehaviorSubject<any>({ chatId: '1', senderId: '2' })
    });

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: CallService, useValue: callServiceSpy },
        { provide: PushService, useValue: pushServiceSpy },
        { provide: ChatService, useValue: chatServiceSpy },
        { provide: PresenceService, useValue: jasmine.createSpyObj('PresenceService', ['setPresence']) },
        { provide: SoundService, useValue: jasmine.createSpyObj('SoundService', ['playMessageSound']) },
        { provide: ModalController, useValue: jasmine.createSpyObj('ModalController', ['create']) },
        { provide: AlertController, useValue: jasmine.createSpyObj('AlertController', ['create']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigateByUrl']) }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should initialize services on ngOnInit', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    await app.ngOnInit();
    expect(pushServiceSpy.initPush).toHaveBeenCalled();
    expect(callServiceSpy.init).toHaveBeenCalled();
  });
});
