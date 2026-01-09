import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupCallPage } from './group-call.page';

describe('GroupCallPage', () => {
  let component: GroupCallPage;
  let fixture: ComponentFixture<GroupCallPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GroupCallPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
