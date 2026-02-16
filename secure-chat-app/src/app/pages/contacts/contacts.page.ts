import { ContactResolverService } from 'src/app/services/contact-resolver.service';
import { ChatService } from 'src/app/services/chat.service';
import { Share } from '@capacitor/share';
import { AlertController } from '@ionic/angular';
import { LoggingService } from 'src/app/services/logging.service';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.page.html',
  styleUrls: ['./contacts.page.scss'],
  standalone: false
})


// ...

export class ContactsPage implements OnInit {
  contacts: any[] = [];
  groupedContacts: { letter: string, contacts: any[] }[] = [];
  globalResults: any[] = [];
  searchQuery: string = '';
  isSearchingGlobally = false;

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
  }

  async loadContacts(event?: any) {
    this.logger.log("Loading contacts...");

    try {
      // 1. Fetch from Local SQLite (Instant)
      this.contacts = await this.contactResolver.getResolvedContacts();
      this.updateGroupedContacts();

      // 2. Background Sync (Throttled)
      this.contactResolver.syncContacts().then(async () => {
        // Re-load if sync updated something
        this.contacts = await this.contactResolver.getResolvedContacts();
        this.updateGroupedContacts();
      });

    } catch (e) {
      this.logger.error("Sync failed", e);
    } finally {
      if (event) event.target.complete();
    }
  }

  updateGroupedContacts() {
    let filtered = this.contacts;

    // Search Filter
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.displayName && c.displayName.toLowerCase().includes(q)) ||
        (c.phone_number && c.phone_number.includes(q)) ||
        (c.short_note && c.short_note.toLowerCase().includes(q))
      );
    }

    // Sort Alphabetically
    filtered.sort((a, b) => (a.displayName || '').localeCompare((b.displayName || ''), undefined, { sensitivity: 'base' }));

    // Group by First Letter
    const groups: { [key: string]: any[] } = {};
    filtered.forEach(c => {
      const letter = (c.displayName || '#').charAt(0).toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    this.groupedContacts = Object.keys(groups).sort().map(letter => ({
      letter,
      contacts: groups[letter]
    }));
  }

  onSearchChange(event: any) {
    this.searchQuery = event.detail.value;
    this.updateGroupedContacts();

    if (this.searchQuery && this.searchQuery.length > 3) {
      this.globalSearch();
    } else {
      this.globalResults = [];
    }
  }

  async globalSearch() {
    this.isSearchingGlobally = true;
    try {
      const results: any = await this.contactsService.searchGlobal(this.searchQuery);
      // Filter out people already in my contacts
      this.globalResults = results.filter((r: any) =>
        !this.contacts.some(c => c.user_id === r.user_id) &&
        r.user_id !== localStorage.getItem('user_id')
      );
    } catch (e) {
      this.logger.error("Global Search Error", e);
    } finally {
      this.isSearchingGlobally = false;
    }
  }

  async addContact() {
    const alert = await this.alertCtrl.create({
      header: 'New Contact',
      message: 'Enter phone number (with country code):',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Name (Optional)' },
        { name: 'phone', type: 'tel', placeholder: '+1234567890' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add & Chat',
          handler: async (data) => {
            if (data.phone) {
              this.findAndChat(data.phone);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async findAndChat(phone: string) {
    try {
      // v2.3 Flow: We don't have a direct "lookup" endpoint for privacy.
      // We usually sync the address book and then open.
      // For a one-off "New Message", we'd need a backend lookup by SHA256.
      // Since the backend 'contacts/map.php' handles batches, we'll use it.
      const t = await this.toast.create({ message: 'Searching...', duration: 1000 });
      t.present();

      // Temporary implementation: Use resolver sync logic for this number
      // In a full app, we'd have a specific lookup endpoint.
      this.router.navigate(['/home']); // Redir for now as placeholder
    } catch (e) {
      this.logger.error("Error finding contact", e);
    }
  }

  async inviteFriend() {
    try {
      const myId = localStorage.getItem('user_id');
      const link = `https://snapflect.com/?ref=${myId}`; // Generalized Invite Link

      await Share.share({
        title: 'Join me on ChatFlect!',
        text: 'Let\'s chat securely! Download ChatFlect here: ',
        url: link,
        dialogTitle: 'Invite Friends'
      });
    } catch (e) {
      if ((e as any).message !== 'Share canceled') { // Ignore user cancellation logic
        this.logger.error("Share failed", e);
      }
    }
  }

  async startChat(contact: any) {
    if (!contact.user_id && !contact.id) return;
    const targetId = contact.user_id || contact.id; // API returns user_id, fallback to id

    try {
      const chatId = await this.chatService.getOrCreateChat(targetId);
      this.router.navigate(['/chat-detail', chatId]);
    } catch (e: any) {
      this.logger.error("Chat Init Error", e);
      const msg = (e && e.message) ? e.message : 'Detailed error unavailable';
      const t = await this.toast.create({ message: 'Chat Error: ' + msg, duration: 2000 });
      t.present();
    }
  }
}
