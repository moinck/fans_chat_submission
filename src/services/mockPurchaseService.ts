import { randomUUID } from 'expo-crypto';
import { PurchaseEvent, PurchaseOutcome } from '../domain/purchase';
import { SQLitePurchaseHistoryRepository } from '../repositories/sqlitePurchaseHistoryRepository';

export class PurchaseCancelled extends Error {}
export class PurchaseFailed extends Error {}

export class MockPurchaseService {
  outcome: PurchaseOutcome = 'success';
  purchaseCalls = 0;
  /** In-memory fallback list (used by tests that don't supply a repository). */
  private purchases: PurchaseEvent[] = [];

  constructor(private repository?: SQLitePurchaseHistoryRepository) {}

  async purchase(productId: string): Promise<PurchaseEvent> {
    this.purchaseCalls++;
    await new Promise(resolve => setTimeout(resolve, 250));
    if (this.outcome === 'cancel') throw new PurchaseCancelled('Purchase cancelled');
    if (this.outcome === 'fail') throw new PurchaseFailed('Store unavailable');
    const event: PurchaseEvent = { transactionId: randomUUID(), productId, purchasedAt: Date.now() };
    this.purchases.push(event);
    await this.repository?.add(event);
    return event;
  }

  async restore(): Promise<PurchaseEvent[]> {
    if (this.repository) return this.repository.list();
    return [...this.purchases];
  }

  async seedExisting(event: PurchaseEvent): Promise<void> {
    if (!this.purchases.some(p => p.transactionId === event.transactionId)) {
      this.purchases.push(event);
    }
    await this.repository?.add(event);
  }

  async resetPurchases(): Promise<void> {
    this.purchases = [];
    await this.repository?.clear();
  }
}
