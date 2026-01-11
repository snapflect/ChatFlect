import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusCreatorPage } from './status-creator.page';
import { IonicModule, NavController, LoadingController, ToastController } from '@ionic/angular';
import { StatusService } from 'src/app/services/status.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

describe('StatusCreatorPage', () => {
  let component: StatusCreatorPage;
  let fixture: ComponentFixture<StatusCreatorPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatusCreatorPage],
      imports: [IonicModule.forRoot(), FormsModule, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: StatusService, useValue: jasmine.createSpyObj('StatusService', ['uploadStatus', 'uploadTextStatus']) },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['back']) },
        { provide: LoadingController, useValue: jasmine.createSpyObj('LoadingController', { create: Promise.resolve({ present: () => Promise.resolve(), dismiss: () => Promise.resolve() }) }) },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', { create: Promise.resolve({ present: () => Promise.resolve() }) }) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StatusCreatorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
