import { MockEntitlementBackend } from '../src/services/mockEntitlementBackend';
import { MockPurchaseService } from '../src/services/mockPurchaseService';
import { PurchaseCoordinator } from '../src/services/purchaseCoordinator';
import { InMemoryEntitlementRepository } from '../src/test/inMemoryRepositories';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
test('store success stays locked until delayed backend confirmation', async () => {
  const store = new MockPurchaseService(); const backend = new MockEntitlementBackend(); backend.mode = 'delayed';
  const repository = new InMemoryEntitlementRepository(); const states: string[] = [];
  const coordinator = new PurchaseCoordinator(store, backend, repository, state => states.push(state));
  const purchase = coordinator.purchase(); await wait(300);
  expect(states).toContain('purchased-awaiting-confirmation');
  expect((await repository.get()).status).toBe('inactive');
  backend.confirmPending(); await purchase;
  expect((await repository.get()).status).toBe('active');
});
