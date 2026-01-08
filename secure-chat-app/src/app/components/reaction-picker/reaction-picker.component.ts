import { Component } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
    selector: 'app-reaction-picker',
    template: `
    <div class="reaction-grid">
      <div *ngFor="let emoji of emojis" (click)="select(emoji)" class="emoji-btn">
        {{ emoji }}
      </div>
    </div>
  `,
    styles: [`
    .reaction-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 10px;
      padding: 10px;
      background: #333;
    }
    .emoji-btn {
      font-size: 24px;
      cursor: pointer;
      text-align: center;
      transition: transform 0.1s;
    }
    .emoji-btn:active {
      transform: scale(1.2);
    }
  `],
    standalone: false
})
export class ReactionPickerComponent {
    emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

    constructor(private popoverCtrl: PopoverController) { }

    select(emoji: string) {
        this.popoverCtrl.dismiss({ reaction: emoji });
    }
}
