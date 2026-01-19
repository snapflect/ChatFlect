import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { GiphyService, GiphyGif } from 'src/app/services/giphy.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
    selector: 'app-gif-picker',
    templateUrl: './gif-picker.component.html',
    styleUrls: ['./gif-picker.component.scss'],
    standalone: false
})
export class GifPickerComponent implements OnInit {
    @Output() gifSelected = new EventEmitter<GiphyGif>();
    @Output() close = new EventEmitter<void>();

    gifs: GiphyGif[] = [];
    searchQuery = '';
    isLoading = false;
    hasMore = true;
    currentOffset = 0;

    private searchSubject = new Subject<string>();

    constructor(private giphyService: GiphyService) { }

    ngOnInit() {
        // Setup debounced search
        this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged()
        ).subscribe(query => {
            this.performSearch(query);
        });

        // Load trending on init
        this.loadTrending();
    }

    onSearchInput() {
        this.searchSubject.next(this.searchQuery);
    }

    private loadTrending() {
        this.isLoading = true;
        this.giphyService.getTrendingGifs().subscribe({
            next: (result) => {
                this.gifs = result.gifs;
                this.hasMore = result.gifs.length > 0 && result.pagination.total > result.gifs.length;
                this.currentOffset = result.gifs.length;
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
            }
        });
    }

    private performSearch(query: string) {
        this.isLoading = true;
        this.currentOffset = 0;

        this.giphyService.searchGifs(query).subscribe({
            next: (result) => {
                this.gifs = result.gifs;
                this.hasMore = result.gifs.length > 0 && result.pagination.total > result.gifs.length;
                this.currentOffset = result.gifs.length;
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
            }
        });
    }

    loadMore() {
        if (this.isLoading || !this.hasMore) return;

        this.isLoading = true;
        const searchFn = this.searchQuery
            ? this.giphyService.searchGifs(this.searchQuery, this.currentOffset)
            : this.giphyService.getTrendingGifs(this.currentOffset);

        searchFn.subscribe({
            next: (result) => {
                this.gifs = [...this.gifs, ...result.gifs];
                this.hasMore = result.gifs.length > 0;
                this.currentOffset += result.gifs.length;
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
            }
        });
    }

    selectGif(gif: GiphyGif) {
        this.gifSelected.emit(gif);
    }

    closePanel() {
        this.close.emit();
    }

    clearSearch() {
        this.searchQuery = '';
        this.loadTrending();
    }

    getAttribution(): string {
        return this.giphyService.getAttribution();
    }
}
