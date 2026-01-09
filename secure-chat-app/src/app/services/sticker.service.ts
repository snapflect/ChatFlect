import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class StickerService {

    // Publicly hosted Giphy URLs (Safe for MVP demo)
    private stickers = [
        { id: '1', url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', title: 'Applause' },
        { id: '2', url: 'https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif', title: 'Celebration' },
        { id: '3', url: 'https://media.giphy.com/media/26hirEPeos6yugL1S/giphy.gif', title: 'Thumbs Up' },
        { id: '4', url: 'https://media.giphy.com/media/d9QiBcfzg64Io/giphy.gif', title: 'Cat' },
        { id: '5', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif', title: 'Cat 2' },
        { id: '6', url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif', title: 'Dog' },
        { id: '7', url: 'https://media.giphy.com/media/l0ExkEkBl7Grk78tO/giphy.gif', title: 'Dance' },
        { id: '8', url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', title: 'Thinking' },
        { id: '9', url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', title: 'Wow' },
        { id: '10', url: 'https://media.giphy.com/media/cFdTq996b6Fuyb3iBq/giphy.gif', title: 'Heart' },
        { id: '11', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', title: 'Laugh' },
        { id: '12', url: 'https://media.giphy.com/media/xT5LMHxhNC0yZ6KSZI/giphy.gif', title: 'Sad' },
    ];

    constructor() { }

    getTrending(): Observable<any[]> {
        return of(this.stickers);
    }

    search(query: string): Observable<any[]> {
        const q = query.toLowerCase();
        const results = this.stickers.filter(s => s.title.toLowerCase().includes(q));
        return of(results.length > 0 ? results : this.stickers); // Fallback to trending if no match for MVP
    }
}
