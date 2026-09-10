import { Entitlement } from '../domain/entitlement';
import { PurchaseEvent, PurchaseState } from '../domain/purchase';
import { EntitlementRepository } from '../repositories/entitlementRepository';
import { MockEntitlementBackend } from './mockEntitlementBackend';
import { MockPurchaseService, PurchaseCancelled } from './mockPurchaseService';

type Publish = (state: PurchaseState, entitlement: Entitlement, detail?: string) => void;
export class PurchaseCoordinator {
  private busy = false;
  private processing = new Set<string>();
  constructor(private store: MockPurchaseService, private backend: MockEntitlementBackend, private repository: EntitlementRepository, private publish: Publish = () => {}) {}
  async purchase(productId = 'creator.monthly') {
    if (this.busy) return;
    this.busy = true; const current = await this.repository.get(); this.publish('purchasing', current);
    try {
      const event = await this.store.purchase(productId);
      this.publish('purchased-awaiting-confirmation', current, 'Store purchase complete. Confirming access…');
      await this.process(event);
      this.publish('idle', await this.repository.get());
    } catch (error) {
      this.publish(error instanceof PurchaseCancelled ? 'cancelled' : 'failed', await this.repository.get(), error instanceof PurchaseCancelled ? 'No charge was made.' : 'Purchase failed. Try again.');
    } finally { this.busy = false; }
  }
  async process(event: PurchaseEvent) {
    if (this.processing.has(event.transactionId)) return;
    this.processing.add(event.transactionId);
    try {
      if (await this.repository.hasProcessedTransaction(event.transactionId)) return;
      const candidate = await this.backend.validate(event);
      const current = await this.repository.get();
      if (candidate.status === 'active' || current.status !== 'active') await this.repository.saveIfNewer(candidate);
      await this.repository.markTransactionProcessed(event.transactionId);
    } finally { this.processing.delete(event.transactionId); }
  }
  async restore() {
    if (this.busy) return;
    this.busy = true; this.publish('restoring', await this.repository.get());
    try { for (const event of await this.store.restore()) await this.process(event); this.publish('idle', await this.repository.get(), 'Purchases restored.'); }
    finally { this.busy = false; }
  }
  async applyStatus(status: 'expired' | 'refunded') { await this.repository.saveIfNewer(this.backend.status(status)); this.publish('idle', await this.repository.get()); }
}
