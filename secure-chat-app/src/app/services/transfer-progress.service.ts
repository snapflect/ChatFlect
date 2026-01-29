import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ProgressUpdate {
    id: string; // URL or Message ID
    percentage: number;
    status: 'uploading' | 'downloading' | 'completed' | 'failed';
}

@Injectable({
    providedIn: 'root'
})
export class TransferProgressService {
    private progressState = new BehaviorSubject<{ [key: string]: ProgressUpdate }>({});

    constructor() { }

    updateProgress(id: string, percentage: number, status: 'uploading' | 'downloading' | 'completed' | 'failed') {
        const current = this.progressState.value;
        this.progressState.next({
            ...current,
            [id]: { id, percentage, status }
        });
    }

    getProgress(id: string): Observable<ProgressUpdate | undefined> {
        return this.progressState.asObservable().pipe(
            map(state => state[id])
        );
    }

    clearProgress(id: string) {
        const current = { ...this.progressState.value };
        delete current[id];
        this.progressState.next(current);
    }
}
