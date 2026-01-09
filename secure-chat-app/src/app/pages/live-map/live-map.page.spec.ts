import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveMapPage } from './live-map.page';

describe('LiveMapPage', () => {
  let component: LiveMapPage;
  let fixture: ComponentFixture<LiveMapPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LiveMapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
