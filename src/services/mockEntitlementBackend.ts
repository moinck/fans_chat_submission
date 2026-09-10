import { Entitlement, initialEntitlement } from '../domain/entitlement';
import { ConfirmationMode, PurchaseEvent } from '../domain/purchase';

export class MockEntitlementBackend {
  mode: ConfirmationMode = 'immediate';
  validationCalls = 0;
  private version = Date.now();
  private delayed: Array<() => void> = [];
  async validate(event: PurchaseEvent): Promise<Entitlement> {
    this.validationCalls++;
    if (this.mode === 'delayed') await new Promise<void>(resolve => this.delayed.push(resolve));
    this.version = Math.max(this.version + 1, Date.now());
    if (this.mode === 'reject') return { ...initialEntitlement, productId: event.productId, version: this.version };
    return { status: 'active', productId: event.productId, confirmedAt: Date.now(), expiresAt: Date.now() + 30 * 86400000, version: this.version };
  }
  confirmPending() { const pending = [...this.delayed]; this.delayed = []; this.mode = 'immediate'; pending.forEach(resolve => resolve()); }
  status(status: 'expired' | 'refunded', productId = 'creator.monthly'): Entitlement {
    return { status, productId, confirmedAt: Date.now(), expiresAt: status === 'expired' ? Date.now() : null, version: (this.version = Math.max(this.version + 1, Date.now())) };
  }
}
