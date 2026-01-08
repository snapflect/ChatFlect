import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupInfoPage } from './group-info.page';

describe('GroupInfoPage', () => {
  let component: GroupInfoPage;
  let fixture: ComponentFixture<GroupInfoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GroupInfoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
