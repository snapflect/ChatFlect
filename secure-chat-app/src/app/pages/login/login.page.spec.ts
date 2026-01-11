import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LoginPage } from './login.page';
import { IonicModule, NavController, LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { LinkService } from 'src/app/services/link.service';
import { LoggingService } from 'src/app/services/logging.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AuthService', ['requestOtp', 'verifyOtp']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [LoginPage],
      imports: [IonicModule.forRoot(), FormsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: LinkService, useValue: jasmine.createSpyObj('LinkService', ['generateLinkSession', 'listenForSync']) },
        { provide: LoggingService, useValue: jasmine.createSpyObj('LoggingService', ['log', 'error']) },
        { provide: Router, useValue: routerSpy },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) },
        { provide: LoadingController, useValue: jasmine.createSpyObj('LoadingController', { create: Promise.resolve({ present: () => Promise.resolve(), dismiss: () => Promise.resolve() }) }) },
        NavController
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be in phone mode by default', () => {
    expect(component.mode).toBe('phone');
  });

  it('should send OTP and set otpSent to true', (done) => {
    component.phoneNumber = '+1234567890';
    component.email = 'test@test.com';
    authSpy.requestOtp.and.returnValue(of({ status: 'success' }));

    const toastSpy = TestBed.inject(ToastController) as any;
    toastSpy.create.and.returnValue(Promise.resolve({ present: () => Promise.resolve() }));

    component.sendOtp().then(() => {
      expect(authSpy.requestOtp).toHaveBeenCalledWith(component.phoneNumber, component.email);
      expect(component.otpSent).toBeTrue();
      done();
    });
  });

  it('should verify OTP and navigate on success', fakeAsync(() => {
    component.phoneNumber = '+1234567890';
    component.email = 'test@test.com';
    component.otp = '123456';

    authSpy.verifyOtp.and.returnValue(Promise.resolve({ status: 'success', user_id: '123', is_new_user: false }));

    const toastSpy = TestBed.inject(ToastController) as any;
    toastSpy.create.and.returnValue(Promise.resolve({ present: () => Promise.resolve() }));

    component.verifyOtp();
    tick();

    expect(authSpy.verifyOtp).toHaveBeenCalledWith(component.phoneNumber, component.otp, component.email);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/tabs']);
  }));
});
