import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SecurityHistoryPage } from './security-history.page';

describe('SecurityHistoryPage', () => {
  let component: SecurityHistoryPage;
  let fixture: ComponentFixture<SecurityHistoryPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SecurityHistoryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
