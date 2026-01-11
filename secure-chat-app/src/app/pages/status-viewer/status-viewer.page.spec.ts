import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusViewerPage } from './status-viewer.page';
import { IonicModule, ModalController } from '@ionic/angular';
import { StatusService } from 'src/app/services/status.service';
import { of } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('StatusViewerPage', () => {
  let component: StatusViewerPage;
  let fixture: ComponentFixture<StatusViewerPage>;
  let statusServiceSpy: jasmine.SpyObj<StatusService>;

  beforeEach(async () => {
    statusServiceSpy = jasmine.createSpyObj('StatusService', ['recordView']);
    statusServiceSpy.recordView.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      declarations: [StatusViewerPage],
      imports: [IonicModule.forRoot(), HttpClientTestingModule],
      providers: [
        { provide: ModalController, useValue: jasmine.createSpyObj('ModalController', ['dismiss']) },
        { provide: StatusService, useValue: statusServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StatusViewerPage);
    component = fixture.componentInstance;
    component.userStatuses = [{ id: '1', url: 'test.jpg' }];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
