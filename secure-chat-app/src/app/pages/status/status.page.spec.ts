import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusPage } from './status.page';
import { IonicModule, ModalController, ToastController, AlertController, ActionSheetController } from '@ionic/angular';
import { StatusService } from 'src/app/services/status.service';
import { of, BehaviorSubject } from 'rxjs';
import { ProfileService } from 'src/app/services/profile.service';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('StatusPage', () => {
  let component: StatusPage;
  let fixture: ComponentFixture<StatusPage>;
  let statusServiceSpy: jasmine.SpyObj<StatusService>;
  let profileServiceSpy: jasmine.SpyObj<ProfileService>;

  beforeEach(async () => {
    statusServiceSpy = jasmine.createSpyObj('StatusService', [
      'getFeed', 'uploadStatus', 'getViewers', 'deleteStatus',
      'muteUser', 'isUserMuted', 'isViewed', 'markAsViewed', 'loadMutedUsers'
    ]);
    statusServiceSpy.getFeed.and.returnValue(of([]));
    statusServiceSpy.mutedUsers$ = new BehaviorSubject<string[]>([]).asObservable();
    statusServiceSpy.isViewed.and.returnValue(false);
    statusServiceSpy.isUserMuted.and.returnValue(false);

    profileServiceSpy = jasmine.createSpyObj('ProfileService', ['getProfile']);
    profileServiceSpy.getProfile.and.resolveTo({ photo_url: 'http://test.com/me.jpg' });

    // Mock localStorage
    spyOn(localStorage, 'getItem').and.returnValue('test-user-id');

    await TestBed.configureTestingModule({
      declarations: [StatusPage],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: StatusService, useValue: statusServiceSpy },
        { provide: ProfileService, useValue: profileServiceSpy },
        { provide: ModalController, useValue: jasmine.createSpyObj('ModalController', ['create']) },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) },
        { provide: AlertController, useValue: jasmine.createSpyObj('AlertController', ['create']) },
        { provide: ActionSheetController, useValue: jasmine.createSpyObj('ActionSheetController', ['create']) }
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(StatusPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(profileServiceSpy.getProfile).toHaveBeenCalled();
  });

  it('should load profile pic', async () => {
    await fixture.whenStable();
    expect(component.myProfilePic).toBe('http://test.com/me.jpg');
  });

  it('should load status feed on init', () => {
    expect(statusServiceSpy.getFeed).toHaveBeenCalled();
  });

  it('should identify my status vs others', () => {
    const mockFeed = [
      { user_id: 'test-user-id', first_name: 'Me', type: 'image', media_url: 'test.jpg' },
      { user_id: 'other-user', first_name: 'Other', type: 'text', text_content: 'Hello' }
    ];
    statusServiceSpy.getFeed.and.returnValue(of(mockFeed));

    component.loadStatus();

    expect(component.myStatus).toBeTruthy();
    expect(component.recentUpdates.length + component.viewedUpdates.length + component.mutedUpdates.length).toBe(1);
  });

  it('should check if user has unviewed updates', () => {
    const mockUser = {
      user_id: 'test',
      name: 'Test',
      avatar: '',
      updates: [{ id: '1' }, { id: '2' }]
    };

    statusServiceSpy.isViewed.and.callFake((id: string) => id === '1');

    expect(component.hasUnviewedUpdates(mockUser)).toBeTrue();
  });

  it('should calculate viewed segments correctly', () => {
    const mockUser = {
      user_id: 'test',
      name: 'Test',
      avatar: '',
      updates: [{ id: '1' }, { id: '2' }, { id: '3' }]
    };

    statusServiceSpy.isViewed.and.callFake((id: string) => id === '1' || id === '2');

    const result = component.getViewedSegments(mockUser);
    expect(result.viewed).toBe(2);
    expect(result.total).toBe(3);
  });
});
