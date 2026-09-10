import { MockEntitlementBackend } from '../src/services/mockEntitlementBackend';
import { MockPurchaseService } from '../src/services/mockPurchaseService';
import { PurchaseCoordinator } from '../src/services/purchaseCoordinator';
import { EntitlementMemory, InMemoryEntitlementRepository } from '../src/test/inMemoryRepositories';

const active = { status: 'active' as const, productId: 'creator.monthly', confirmedAt: 1, expiresAt: 9999999999999, version: 4 };
test('duplicate taps/events are single flight and a failed attempt preserves access', async () => {
  const memory: EntitlementMemory = { entitlement: active, transactions: new Set() };
  const repository = new InMemoryEntitlementRepository(memory); const store = new MockPurchaseService(); const backend = new MockEntitlementBackend();
  const coordinator = new PurchaseCoordinator(store, backend, repository);
  store.outcome = 'fail'; await Promise.all([coordinator.purchase(), coordinator.purchase(), coordinator.purchase()]);
  expect(store.purchaseCalls).toBe(1); expect((await repository.get()).status).toBe('active');
  const event = { transactionId: 'T1', productId: 'creator.monthly', purchasedAt: 1 };
  await Promise.all([coordinator.process(event), coordinator.process(event), coordinator.process(event)]);
  expect(backend.validationCalls).toBe(1);
});
