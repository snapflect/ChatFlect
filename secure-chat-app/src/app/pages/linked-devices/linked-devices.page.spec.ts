import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LinkedDevicesPage } from './linked-devices.page';

describe('LinkedDevicesPage', () => {
  let component: LinkedDevicesPage;
  let fixture: ComponentFixture<LinkedDevicesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LinkedDevicesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
