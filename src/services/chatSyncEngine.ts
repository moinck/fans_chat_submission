import { randomUUID } from 'expo-crypto';
import { ClientMessage, mergeMessages } from '../domain/message';
import { ClientMessageRepository } from '../repositories/clientMessageRepository';
import { ChatServiceError, MockChatService } from './mockChatService';

export class ChatSyncEngine {
  private flushing = false;
  private flushRequested = false;
  private messages: ClientMessage[] = [];
  constructor(private client: ClientMessageRepository, private service: MockChatService, private publish: (messages: ClientMessage[]) => void = () => {}) {}
  private emit(incoming: ClientMessage[] = []) { this.messages = mergeMessages(this.messages, incoming); this.publish(this.messages); }
  async hydrate() { this.messages = await this.client.list(); this.publish(this.messages); return this.messages; }
  async enqueue(text: string, id = randomUUID()) {
    const message: ClientMessage = { clientId: id, serverId: null, text: text.trim(), createdLocallyAt: Date.now(), serverSequence: null, deliveryState: 'pending', attemptCount: 0, lastErrorCode: null, author: 'me' };
    await this.client.enqueue(message); // durability before optimistic publication
    this.emit([message]);
    if (this.service.online) await this.flush();
    return message;
  }
  async sync() { if (!this.service.online) return; await this.catchUp(); await this.flush(); }
  async catchUp() {
    let cursor = Math.max(0, ...this.messages.map(m => m.serverSequence ?? 0));
    while (true) {
      const page = await this.service.incomingAfter(cursor, 100);
      if (!page.length) break;
      for (const message of page) await this.client.upsert(message);
      this.emit(page); cursor = page[page.length - 1].serverSequence;
      if (page.length < 100) break;
    }
  }
  async flush() {
    if (this.flushing) { this.flushRequested = true; return; }
    if (!this.service.online) return;
    this.flushing = true;
    try {
      const outbox = await this.client.listOutbox();
      for (const original of outbox) {
        if (original.deliveryState === 'failed-terminal') continue;
        const sending: ClientMessage = { ...original, deliveryState: 'sending', attemptCount: original.attemptCount + 1, lastErrorCode: null };
        await this.client.upsert(sending); this.emit([sending]);
        try {
          const accepted = await this.service.send(sending.clientId, sending.text);
          await this.client.upsert(accepted); this.emit([accepted]);
        } catch (error) {
          const e = error instanceof ChatServiceError ? error : new ChatServiceError('UNKNOWN', true);
          const failed: ClientMessage = { ...sending, deliveryState: e.code === 'OFFLINE' ? 'pending' : e.retryable ? 'failed-retryable' : 'failed-terminal', lastErrorCode: e.code };
          await this.client.upsert(failed); this.emit([failed]);
          if (e.code === 'OFFLINE') break;
        }
      }
    } finally {
      this.flushing = false;
      if (this.flushRequested) { this.flushRequested = false; await this.flush(); }
    }
  }
  async retry(clientId: string) {
    const message = await this.client.get(clientId);
    if (!message || message.deliveryState === 'sent' || message.deliveryState === 'failed-terminal') return;
    const pending: ClientMessage = { ...message, deliveryState: 'pending', lastErrorCode: null };
    await this.client.upsert(pending); this.emit([pending]); await this.flush();
  }
  async loadOlder() {
    const first = this.messages.find(m => m.serverSequence !== null)?.serverSequence;
    if (!first) return;
    const older = await this.client.listBefore(first, 50); this.emit(older);
  }
}
