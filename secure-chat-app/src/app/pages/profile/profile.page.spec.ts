import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfilePage } from './profile.page';
import { IonicModule, NavController, ToastController, ActionSheetController, ModalController } from '@ionic/angular';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ProfileService } from 'src/app/services/profile.service';
import { LoggingService } from 'src/app/services/logging.service';
import { AuthService } from 'src/app/services/auth.service';
import { FormsModule } from '@angular/forms';

describe('ProfilePage', () => {
  let component: ProfilePage;
  let fixture: ComponentFixture<ProfilePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProfilePage],
      imports: [IonicModule.forRoot(), HttpClientTestingModule, FormsModule],
      providers: [
        { provide: ProfileService, useValue: jasmine.createSpyObj('ProfileService', ['getProfile', 'updateProfile', 'uploadPhoto']) },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['getProfile', 'updateProfile']) },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['back', 'navigateRoot']) },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', { create: Promise.resolve({ present: () => Promise.resolve() }) }) },
        { provide: ActionSheetController, useValue: jasmine.createSpyObj('ActionSheetController', ['create']) },
        { provide: LoggingService, useValue: jasmine.createSpyObj('LoggingService', ['error']) },
        { provide: ModalController, useValue: jasmine.createSpyObj('ModalController', ['create']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
