import { Component, OnInit } from '@angular/core';
import { CallService } from 'src/app/services/call.service';

@Component({
  selector: 'app-calls',
  templateUrl: './calls.page.html',
  styleUrls: ['./calls.page.scss'],
  standalone: false
})
export class CallsPage implements OnInit {

  calls: any[] = [];
  myId = localStorage.getItem('user_id');

  constructor(
    private callService: CallService
  ) { }

  ngOnInit() {
    this.loadHistory();
  }

  ionViewWillEnter() {
    this.loadHistory();
  }

  loadHistory() {
    this.callService.getCallHistory().subscribe((res: any[]) => {
      this.calls = res;
    });
  }

  getCallIcon(call: any) {
    if (call.type === 'video') return 'videocam';
    return 'call';
  }

  getCallStatusIcon(call: any) {
    const isCaller = String(call.caller_id) === String(this.myId);
    if (isCaller) return 'arrow-forward'; // Outgoing
    // Incoming: Check if missed? 
    // Current DB just has 'calls' log. Status might be 'ended' or 'offer' (missed).
    // If status is 'offer' and I am receiver, it means I never answered -> Missed.
    // But we just store raw rows. Let's assume if I didn't answer (no answer blob?), it's missed.
    // Or checking 'status' field if we update it.
    // For MVP, arrow-back for incoming.
    return 'arrow-back';
  }

  getColor(call: any) {
    const isCaller = String(call.caller_id) === String(this.myId);
    if (!isCaller && call.status === 'offer') return 'danger'; // Missed
    return 'medium';
  }
}
