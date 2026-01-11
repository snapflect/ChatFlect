import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsPage } from './settings.page';
import { IonicModule, NavController, AlertController, ToastController } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { ApiService } from 'src/app/services/api.service';
import { LoggingService } from 'src/app/services/logging.service';
import { CryptoService } from 'src/app/services/crypto.service';
import { LinkService } from 'src/app/services/link.service';
import { of } from 'rxjs';

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SettingsPage],
      imports: [IonicModule.forRoot(), FormsModule, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['logout', 'deleteAccount', 'getProfile', 'updateProfile'], { currentUserId: of('my_id') }) },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['navigateRoot', 'navigateForward']) },
        { provide: ApiService, useValue: jasmine.createSpyObj('ApiService', ['post', 'get']) },
        { provide: LoggingService, useValue: jasmine.createSpyObj('LoggingService', ['log', 'error']) },
        { provide: CryptoService, useValue: jasmine.createSpyObj('CryptoService', ['generateSessionKey']) },
        { provide: LinkService, useValue: jasmine.createSpyObj('LinkService', ['sendSyncData']) },
        { provide: AlertController, useValue: jasmine.createSpyObj('AlertController', ['create']) },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
