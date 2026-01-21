import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactPickerModalPage } from './contact-picker-modal.page';

describe('ContactPickerModalPage', () => {
  let component: ContactPickerModalPage;
  let fixture: ComponentFixture<ContactPickerModalPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactPickerModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
