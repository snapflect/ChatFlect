import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { ContactResolverService, ResolvedContact } from 'src/app/services/contact-resolver.service';
import { ChatService } from 'src/app/services/chat.service';
import { Share } from '@capacitor/share';
import { LoggingService } from 'src/app/services/logging.service';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.page.html',
  styleUrls: ['./contacts.page.scss'],
  standalone: false
})
export class ContactsPage implements OnInit, OnDestroy {
  registeredContacts: ResolvedContact[] = [];
  unregisteredContacts: ResolvedContact[] = [];

  // Display lists (filtered by search)
  groupedRegistered: { letter: string, contacts: ResolvedContact[] }[] = [];
  displayRegisteredCount: number = 0;
  displayUnregistered: ResolvedContact[] = [];

  globalResults: any[] = [];
  searchQuery: string = '';
  isSearchingGlobally = false;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private contactResolver: ContactResolverService,
    private chatService: ChatService,
    private router: Router,
    private toast: ToastController,
    private alertCtrl: AlertController,
    private logger: LoggingService
  ) { }

  ngOnInit() {
    this.loadContacts();

    // Listen to background sync completions
    this.contactResolver.isSyncing$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isSyncing => {
        if (!isSyncing) {
          this.refreshFromLocalDB();
        }
      });

    // Setup Search Debouncer (200ms) to prevent lag during rapid typing
    this.searchSubject.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery = query;
      this.applySearchFilter();

      if (this.searchQuery && this.searchQuery.length > 3) {
        this.globalSearch();
      } else {
        this.globalResults = [];
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadContacts(event?: any) {
    this.logger.log("Loading contacts...");

    try {
      // 1. Fetch from Local SQLite (Instant)
      await this.refreshFromLocalDB();

      // 2. Background Sync (Throttled)
      // Pass false to respect 12h throttling, but pull-to-refresh (event exists) forces sync
      this.contactResolver.syncContacts(!!event);

    } catch (e) {
      this.logger.error("Load failed", e);
    } finally {
      if (event) event.target.complete();
    }
  }

  private async refreshFromLocalDB() {
    const result = await this.contactResolver.getResolvedContacts();
    this.registeredContacts = result.registered;
    this.unregisteredContacts = result.unregistered;
    this.applySearchFilter();
  }

  onSearchChange(event: any) {
    const query = event.detail.value || '';
    this.searchSubject.next(query); // Push to subject for debounced execution
  }

  private applySearchFilter() {
    let filteredReg = this.registeredContacts;
    let filteredUnreg = this.unregisteredContacts;

    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();

      const matchFn = (c: ResolvedContact) =>
        (c.display_name && c.display_name.toLowerCase().includes(q)) ||
        (c.server_name && c.server_name.toLowerCase().includes(q)) ||
        (c.phone_last4 && c.phone_last4.includes(q)) ||
        (c.phone_e164 && c.phone_e164.includes(q));

      filteredReg = filteredReg.filter(matchFn);
      filteredUnreg = filteredUnreg.filter(matchFn);
    }

    // Update Unregistered list safely (avoid overwriting source array)
    this.displayUnregistered = filteredUnreg;

    // Update Registered grouped list
    this.groupRegisteredContacts(filteredReg);
    this.displayRegisteredCount = filteredReg.length;
  }

  private groupRegisteredContacts(filtered: ResolvedContact[]) {
    const groups: { [key: string]: ResolvedContact[] } = {};

    filtered.forEach(c => {
      const letter = (c.display_name || '#').charAt(0).toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    this.groupedRegistered = Object.keys(groups).sort().map(letter => ({
      letter,
      contacts: groups[letter]
    }));
  }

  async inviteContact(contact: ResolvedContact) {
    const defaultMsg = `Hey ${contact.display_name}! Let's chat securely on ChatFlect. Download here: https://snapflect.com/download`;

    const alert = await this.alertCtrl.create({
      header: `Invite ${contact.display_name}`,
      message: 'Customize your invitation message:',
      inputs: [
        {
          name: 'message',
          type: 'textarea',
          value: defaultMsg,
          attributes: { rows: 4 }
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Send Invite',
          handler: async (data) => {
            if (data.message) {
              await this.shareInvite(data.message, contact.phone_e164);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async shareInvite(message: string, phoneE164: string | null) {
    try {
      await Share.share({
        title: 'Join me on ChatFlect!',
        text: message,
        dialogTitle: 'Send Invitation'
      });
    } catch (e) {
      if ((e as any).message !== 'Share canceled') {
        this.logger.error("Share invite failed", e);
      }
    }
  }

  async globalSearch() {
    this.isSearchingGlobally = true;
    try {
      const results: any = await this.contactResolver.searchGlobal(this.searchQuery);
      const myId = localStorage.getItem('user_id');

      // Filter out people already in my registered contacts and myself
      this.globalResults = results.filter((r: any) =>
        !this.registeredContacts.some(c => c.user_id === r.user_id) &&
        r.user_id !== myId
      );
    } catch (e) {
      this.logger.error("Global Search Error", e);
    } finally {
      this.isSearchingGlobally = false;
    }
  }

  async startChat(contact: any) {
    if (!contact.user_id) return;

    try {
      const chatId = await this.chatService.getOrCreateChat(contact.user_id);
      this.router.navigate(['/chat-detail', chatId]);
    } catch (e: any) {
      this.logger.error("Chat Init Error", e);
      const msg = (e && e.message) ? e.message : 'Detailed error unavailable';
      const t = await this.toast.create({ message: 'Chat Error: ' + msg, duration: 2000 });
      t.present();
    }
  }
}
