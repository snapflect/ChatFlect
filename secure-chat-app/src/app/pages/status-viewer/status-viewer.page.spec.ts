import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusViewerPage } from './status-viewer.page';
import { IonicModule, ModalController, ActionSheetController, ToastController } from '@ionic/angular';
import { StatusService } from 'src/app/services/status.service';
import { of, BehaviorSubject } from 'rxjs';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('StatusViewerPage', () => {
  let component: StatusViewerPage;
  let fixture: ComponentFixture<StatusViewerPage>;
  let statusServiceSpy: jasmine.SpyObj<StatusService>;
  let modalCtrlSpy: jasmine.SpyObj<ModalController>;

  beforeEach(async () => {
    statusServiceSpy = jasmine.createSpyObj('StatusService', [
      'recordView', 'markAsViewed', 'deleteStatus', 'muteUser', 'isUserMuted'
    ]);
    statusServiceSpy.recordView.and.returnValue(of({ status: 'success' }));
    statusServiceSpy.deleteStatus.and.returnValue(of({ status: 'success' }));
    statusServiceSpy.muteUser.and.returnValue(of({ status: 'success' }));
    statusServiceSpy.isUserMuted.and.returnValue(false);
    statusServiceSpy.mutedUsers$ = new BehaviorSubject<string[]>([]).asObservable();

    modalCtrlSpy = jasmine.createSpyObj('ModalController', ['dismiss']);

    await TestBed.configureTestingModule({
      declarations: [StatusViewerPage],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: StatusService, useValue: statusServiceSpy },
        { provide: ModalController, useValue: modalCtrlSpy },
        { provide: ActionSheetController, useValue: jasmine.createSpyObj('ActionSheetController', ['create']) },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) }
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(StatusViewerPage);
    component = fixture.componentInstance;

    // Set required inputs
    component.userStatuses = [
      { id: '1', type: 'image', media_url: 'test.jpg', caption: 'Test' }
    ];

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start timer on init', () => {
    expect(component.progress).toBe(0);
  });

  it('should record view on init', () => {
    expect(statusServiceSpy.recordView).toHaveBeenCalledWith('1');
  });

  it('should identify image status', () => {
    component.userStatuses = [{ id: '1', type: 'image', media_url: 'test.jpg' }];
    component.currentIndex = 0;
    expect(component.isImageStatus).toBeTrue();
  });

  it('should identify text status', () => {
    component.userStatuses = [{ id: '1', type: 'text', text_content: 'Hello', background_color: '#FF0000' }];
    component.currentIndex = 0;
    expect(component.isTextStatus).toBeTrue();
  });

  it('should identify video status', () => {
    component.userStatuses = [{ id: '1', type: 'video', media_url: 'test.mp4' }];
    component.currentIndex = 0;
    expect(component.isVideoStatus).toBeTrue();
  });

  it('should identify audio status', () => {
    component.userStatuses = [{ id: '1', type: 'audio', media_url: 'test.mp3' }];
    component.currentIndex = 0;
    expect(component.isAudioStatus).toBeTrue();
  });

  it('should navigate to next status', () => {
    component.userStatuses = [
      { id: '1', type: 'image', media_url: 'test1.jpg' },
      { id: '2', type: 'image', media_url: 'test2.jpg' }
    ];
    component.currentIndex = 0;

    component.next();

    expect(component.currentIndex).toBe(1);
  });

  it('should navigate to previous status', () => {
    component.userStatuses = [
      { id: '1', type: 'image', media_url: 'test1.jpg' },
      { id: '2', type: 'image', media_url: 'test2.jpg' }
    ];
    component.currentIndex = 1;

    component.prev();

    expect(component.currentIndex).toBe(0);
  });

  it('should close on last status next', () => {
    component.userStatuses = [{ id: '1', type: 'image', media_url: 'test.jpg' }];
    component.currentIndex = 0;

    component.next();

    expect(modalCtrlSpy.dismiss).toHaveBeenCalled();
  });

  it('should pause and resume', () => {
    component.pause();
    expect(component.isPaused).toBeTrue();

    component.resume();
    expect(component.isPaused).toBeFalse();
  });

  it('should get media URL', () => {
    const status = { media_url: 'test.jpg' };
    expect(component.getMediaUrl(status)).toBe('test.jpg');
  });

  it('should get media URL from content_url fallback', () => {
    const status = { content_url: 'test2.jpg' };
    expect(component.getMediaUrl(status)).toBe('test2.jpg');
  });
});
