import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { StickerService } from 'src/app/services/sticker.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-sticker-picker',
  templateUrl: './sticker-picker.component.html',
  styleUrls: ['./sticker-picker.component.scss'],
  standalone: false
})
export class StickerPickerComponent implements OnInit {
  @Output() stickerSelected = new EventEmitter<string>();
  stickers: any[] = [];
  searchSubject = new Subject<string>();

  constructor(private stickerService: StickerService) { }

  ngOnInit() {
    this.stickerService.getTrending().subscribe(s => this.stickers = s);

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.stickerService.search(query).subscribe(s => this.stickers = s);
    });
  }

  onSearch(event: any) {
    this.searchSubject.next(event.target.value);
  }

  selectSticker(url: string) {
    this.stickerSelected.emit(url);
  }
}
