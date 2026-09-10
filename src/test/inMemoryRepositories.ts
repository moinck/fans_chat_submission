import { ClientMessage, ServerMessage, sortMessages } from '../domain/message';
import { Entitlement, initialEntitlement } from '../domain/entitlement';
import { ClientMessageRepository } from '../repositories/clientMessageRepository';
import { MockServerRepository } from '../repositories/mockServerRepository';
import { EntitlementRepository } from '../repositories/entitlementRepository';

export type ClientMemory = Map<string, ClientMessage>;
export class InMemoryClientRepository implements ClientMessageRepository {
  constructor(private data: ClientMemory = new Map()) {}
  async enqueue(message: ClientMessage) { if (this.data.has(message.clientId)) throw new Error('duplicate'); this.data.set(message.clientId, { ...message }); }
  async upsert(message: ClientMessage) { this.data.set(message.clientId, { ...message }); }
  async get(id: string) { return this.data.get(id) ?? null; }
  async list(limit = 100) { return sortMessages([...this.data.values()]).slice(-limit); }
  async listBefore(sequence: number, limit = 50) { return sortMessages([...this.data.values()].filter(m => (m.serverSequence ?? Infinity) < sequence)).slice(-limit); }
  async listOutbox() { return sortMessages([...this.data.values()].filter(m => m.author === 'me' && m.deliveryState !== 'sent')); }
  async clear() { this.data.clear(); }
}

export type ServerMemory = { messages: Map<string, ServerMessage>; sequence: number };
export class InMemoryServerRepository implements MockServerRepository {
  constructor(private data: ServerMemory = { messages: new Map(), sequence: 0 }) {}
  async accept(clientId: string, text: string, author: 'me' | 'creator' = 'me') {
    const existing = this.data.messages.get(clientId); if (existing) return existing;
    const sequence = ++this.data.sequence;
    const message: ServerMessage = { clientId, serverId: `server-${sequence}`, text, createdLocallyAt: Date.now(), serverSequence: sequence, deliveryState: 'sent', attemptCount: 0, lastErrorCode: null, author };
    this.data.messages.set(clientId, message); return message;
  }
  async listAfter(sequence: number, limit = 100) { return [...this.data.messages.values()].filter(m => m.serverSequence > sequence).sort((a,b) => a.serverSequence-b.serverSequence).slice(0, limit); }
  async countByClientId(id: string) { return this.data.messages.has(id) ? 1 : 0; }
  async clear() { this.data.messages.clear(); this.data.sequence = 0; }
}

export type EntitlementMemory = { entitlement: Entitlement; transactions: Set<string> };
export class InMemoryEntitlementRepository implements EntitlementRepository {
  constructor(private data: EntitlementMemory = { entitlement: initialEntitlement, transactions: new Set() }) {}
  async get() { return { ...this.data.entitlement }; }
  async saveIfNewer(value: Entitlement) { if (value.version >= this.data.entitlement.version) this.data.entitlement = { ...value }; return this.get(); }
  async hasProcessedTransaction(id: string) { return this.data.transactions.has(id); }
  async markTransactionProcessed(id: string) { this.data.transactions.add(id); }
  async clear() { this.data.entitlement = initialEntitlement; this.data.transactions.clear(); }
}
