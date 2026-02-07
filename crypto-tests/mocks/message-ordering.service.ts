/**
 * Mock for Message Ordering Service (Jest testing)
 */

export interface OrderedMessage {
    id: string;
    serverSeq: number | null;
    localSeq: number;
    timestamp: number;
    content: any;
}

interface ChatSequenceState {
    chatId: string;
    lastLocalSeq: number;
    lastServerSeq: number;
}

export class MessageOrderingService {
    private sequenceStates = new Map<string, ChatSequenceState>();

    getNextLocalSeq(chatId: string): number {
        let state = this.sequenceStates.get(chatId);
        if (!state) {
            state = { chatId, lastLocalSeq: 0, lastServerSeq: 0 };
            this.sequenceStates.set(chatId, state);
        }
        state.lastLocalSeq++;
        return state.lastLocalSeq;
    }

    updateServerSeq(chatId: string, serverSeq: number): void {
        let state = this.sequenceStates.get(chatId);
        if (!state) {
            state = { chatId, lastLocalSeq: serverSeq, lastServerSeq: serverSeq };
            this.sequenceStates.set(chatId, state);
        } else {
            state.lastServerSeq = Math.max(state.lastServerSeq, serverSeq);
            state.lastLocalSeq = Math.max(state.lastLocalSeq, serverSeq);
        }
    }

    sortMessages(messages: OrderedMessage[]): OrderedMessage[] {
        return [...messages].sort((a, b) => {
            if (a.serverSeq !== null && b.serverSeq !== null) {
                return a.serverSeq - b.serverSeq;
            }
            if (a.serverSeq !== null) return -1;
            if (b.serverSeq !== null) return 1;
            if (a.localSeq !== b.localSeq) {
                return a.localSeq - b.localSeq;
            }
            return a.timestamp - b.timestamp;
        });
    }

    reconcileWithServerOrder(
        localMessages: OrderedMessage[],
        serverMessages: OrderedMessage[]
    ): { reordered: boolean; messages: OrderedMessage[] } {
        const serverMap = new Map<string, OrderedMessage>();
        serverMessages.forEach((m) => serverMap.set(m.id, m));

        let reordered = false;
        const reconciled = localMessages.map((local) => {
            const server = serverMap.get(local.id);
            if (server && server.serverSeq !== null) {
                if (local.serverSeq !== server.serverSeq) {
                    reordered = true;
                }
                return { ...local, serverSeq: server.serverSeq };
            }
            return local;
        });

        return { reordered, messages: this.sortMessages(reconciled) };
    }

    detectGaps(chatId: string, messages: OrderedMessage[]): number[] {
        const gaps: number[] = [];
        const seqs = messages
            .filter((m) => m.serverSeq !== null)
            .map((m) => m.serverSeq!)
            .sort((a, b) => a - b);

        for (let i = 1; i < seqs.length; i++) {
            const expected = seqs[i - 1] + 1;
            if (seqs[i] !== expected) {
                for (let g = expected; g < seqs[i]; g++) {
                    gaps.push(g);
                }
            }
        }
        return gaps;
    }

    getSequenceState(chatId: string): ChatSequenceState | null {
        return this.sequenceStates.get(chatId) ?? null;
    }
}
