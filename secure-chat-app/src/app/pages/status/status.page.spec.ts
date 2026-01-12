import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusPage } from './status.page';
import { IonicModule, ModalController, ToastController, AlertController } from '@ionic/angular';
import { StatusService } from 'src/app/services/status.service';
import { of } from 'rxjs';
import { ProfileService } from 'src/app/services/profile.service';

describe('StatusPage', () => {
  let component: StatusPage;
  let fixture: ComponentFixture<StatusPage>;
  let statusServiceSpy: jasmine.SpyObj<StatusService>;
  let profileServiceSpy: jasmine.SpyObj<ProfileService>;

  beforeEach(async () => {
    statusServiceSpy = jasmine.createSpyObj('StatusService', ['getFeed', 'uploadStatus', 'getViewers']);
    statusServiceSpy.getFeed.and.returnValue(of([]));

    profileServiceSpy = jasmine.createSpyObj('ProfileService', ['getProfile']);
    profileServiceSpy.getProfile.and.resolveTo({ photo_url: 'http://test.com/me.jpg' });

    await TestBed.configureTestingModule({
      declarations: [StatusPage],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: StatusService, useValue: statusServiceSpy },
        { provide: ProfileService, useValue: profileServiceSpy },
        { provide: ModalController, useValue: jasmine.createSpyObj('ModalController', ['create']) },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) },
        { provide: AlertController, useValue: jasmine.createSpyObj('AlertController', ['create']) }
      ]
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
});
