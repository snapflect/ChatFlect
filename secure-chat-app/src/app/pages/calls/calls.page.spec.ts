import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CallsPage } from './calls.page';
import { IonicModule } from '@ionic/angular';
import { CallService } from 'src/app/services/call.service';
import { of } from 'rxjs';

describe('CallsPage', () => {
  let component: CallsPage;
  let fixture: ComponentFixture<CallsPage>;
  let callServiceSpy: jasmine.SpyObj<CallService>;

  beforeEach(async () => {
    callServiceSpy = jasmine.createSpyObj('CallService', ['getCallHistory']);

    await TestBed.configureTestingModule({
      declarations: [CallsPage],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: CallService, useValue: callServiceSpy }
      ]
    }).compileComponents();

    callServiceSpy.getCallHistory.and.returnValue(of([]));

    fixture = TestBed.createComponent(CallsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load call history on init', () => {
    expect(callServiceSpy.getCallHistory).toHaveBeenCalled();
  });
});
