import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveMapPage } from './live-map.page';
import { IonicModule, NavController } from '@ionic/angular';
import { LocationService } from 'src/app/services/location.service';
import { ChatService } from 'src/app/services/chat.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('LiveMapPage', () => {
  let component: LiveMapPage;
  let fixture: ComponentFixture<LiveMapPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LiveMapPage],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: LocationService, useValue: jasmine.createSpyObj('LocationService', ['getLiveLocations', 'stopSharing']) },
        { provide: ChatService, useValue: jasmine.createSpyObj('ChatService', ['getChatDetails']) },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['back']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '123' } } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LiveMapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
