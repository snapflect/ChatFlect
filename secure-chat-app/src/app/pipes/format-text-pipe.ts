import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'formatText'
})
export class FormatTextPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) { }

  transform(value: any): SafeHtml {
    if (!value || typeof value !== 'string') return value;

    let text = value;

    // 1. Sanitize HTML chars first to prevent XSS (basic)
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 2. Format Links (https://...)
    // Simple regex for URL detection
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    text = text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" class="chat-link">${url}</a>`;
    });

    // 3. WhatsApp Formatting
    // Bold *text*
    text = text.replace(/\*([^*]+)\*/g, '<b>$1</b>');

    // Italic _text_
    text = text.replace(/_([^_]+)_/g, '<i>$1</i>');

    // Strikethrough ~text~
    text = text.replace(/~([^~]+)~/g, '<s>$1</s>');

    // 4. Line Breaks
    text = text.replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(text);
  }

}
