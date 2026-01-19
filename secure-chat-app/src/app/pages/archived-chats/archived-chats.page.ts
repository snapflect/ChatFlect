import { Component, OnInit, OnDestroy } from '@angular/core';
import { ChatService } from 'src/app/services/chat.service';
import { ContactsService } from 'src/app/services/contacts.service';
import { PresenceService } from 'src/app/services/presence.service';
import { ChatSettingsService } from 'src/app/services/chat-settings.service';
import { combineLatest, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { ActionSheetController, AlertController, IonItemSliding, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-archived-chats',
  templateUrl: './archived-chats.page.html',
  styleUrls: ['./archived-chats.page.scss'],
  standalone: false
})
export class ArchivedChatsPage implements OnInit, OnDestroy {
  archivedChats: any[] = [];
  myId = localStorage.getItem('user_id');
  isLoading = true;

  // Online Status Tracking
  onlineUsers = new Map<string, boolean>();
  private presenceSubscriptions: Subscription[] = [];
  private chatSubscription?: Subscription;
  resolvedUsers = new Map<string, { name: string, photo: string }>();

  constructor(
    private chatService: ChatService,
    private contactService: ContactsService,
    private presenceService: PresenceService,
    private chatSettings: ChatSettingsService,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController
  ) { }

  ngOnInit() {
    this.loadArchivedChats();
  }

  ionViewWillEnter() {
    this.loadArchivedChats();
  }

  ngOnDestroy() {
    this.presenceSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
    }
  }

  loadArchivedChats(): Promise<void> {
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
    }
    this.isLoading = true;
    return new Promise(async (resolve) => {
      await this.contactService.getAllContacts();

      // First, get initial chats to know what settings to load
      this.chatService.getMyChats().pipe(take(1)).subscribe(async (initialChats: any[]) => {
        const chatIds = initialChats.map(c => c.id);
        await this.chatSettings.loadMultipleSettings(chatIds);

        // Now subscribe to the reactive stream for updates (archive/unarchive)
        this.chatSubscription = combineLatest([
          this.chatService.getMyChats(),
          this.chatSettings.settings$
        ]).subscribe(async ([allChats, settingsMap]) => {

          // Filter for ONLY archived chats
          this.archivedChats = allChats.filter(c => this.chatSettings.isArchived(c.id));

          // Resolve names and presence
          for (const chat of this.archivedChats) {
            if (chat.isGroup) {
              chat.name = chat.groupName || 'Unnamed Group';
              chat.avatar = 'assets/group_placeholder.png';
            } else {
              const otherId = chat.participants.find((p: any) => String(p) !== String(this.myId));
              if (otherId) {
                chat.otherUserId = otherId;
                this.subscribeToPresence(otherId);

                if (this.resolvedUsers.has(otherId)) {
                  const cached = this.resolvedUsers.get(otherId);
                  chat.name = cached?.name;
                  chat.avatar = cached?.photo || chat.avatar;
                } else {
                  const contact = this.contactService.localContacts.find((c: any) => String(c.user_id) === String(otherId));
                  if (contact) {
                    chat.name = contact.first_name + ' ' + contact.last_name;
                    chat.avatar = contact.photo_url;
                    this.resolvedUsers.set(otherId, { name: chat.name, photo: chat.avatar });
                  } else {
                    this.chatService.getUserInfo(otherId).then(info => {
                      chat.name = info.username;
                      if (info.photo) chat.avatar = info.photo;
                      this.resolvedUsers.set(otherId, { name: info.username, photo: info.photo });
                    });
                  }
                }
              }
            }
          }

          // Sort by timestamp
          this.archivedChats.sort((a, b) => {
            const aTime = a.lastTimestamp?.seconds || 0;
            const bTime = b.lastTimestamp?.seconds || 0;
            return bTime - aTime;
          });

          this.isLoading = false;
          resolve();
        });
      });
    });
  }

  private subscribeToPresence(userId: string) {
    if (this.onlineUsers.has(userId)) return;
    const sub = this.presenceService.getPresence(userId).subscribe(presence => {
      this.onlineUsers.set(userId, presence?.state === 'online');
    });
    this.presenceSubscriptions.push(sub);
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.get(userId) || false;
  }

  async unarchiveChat(chatId: string, slidingItem: IonItemSliding) {
    await this.chatSettings.toggleArchive(chatId);
    await slidingItem.close();

    // Remove from current list
    this.archivedChats = this.archivedChats.filter(c => c.id !== chatId);
    const toast = await this.toastCtrl.create({ message: 'Chat unarchived', duration: 1500 });
    toast.present();
  }

  getUnreadCount(chat: any) {
    return chat[`unread_${this.myId}`] || 0;
  }

  async presentChatOptions(chat: any) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: chat.name,
      cssClass: 'premium-action-sheet',
      buttons: [
        {
          text: 'Unarchive Chat',
          icon: 'archive-outline',
          handler: () => {
            this.unarchiveChat(chat.id, { close: () => { } } as any);
          }
        },
        {
          text: 'Delete Chat',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => {
            this.confirmDelete(chat.id);
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close'
        }
      ]
    });
    await actionSheet.present();
  }

  async confirmDelete(chatId: string) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Chat?',
      message: 'Are you sure you want to delete this chat? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.chatService.deleteChat(chatId).then(() => {
              this.archivedChats = this.archivedChats.filter(c => c.id !== chatId);
            });
          }
        }
      ]
    });
    await alert.present();
  }
}
