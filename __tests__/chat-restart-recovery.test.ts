import { ChatSyncEngine } from '../src/services/chatSyncEngine';
import { MockChatService } from '../src/services/mockChatService';
import { ClientMemory, InMemoryClientRepository, InMemoryServerRepository } from '../src/test/inMemoryRepositories';

test('three offline messages survive service recreation and flush in order', async () => {
  const disk: ClientMemory = new Map(); const server = new InMemoryServerRepository();
  const offline = new MockChatService(server); offline.online = false;
  const first = new ChatSyncEngine(new InMemoryClientRepository(disk), offline); await first.hydrate();
  await first.enqueue('one', '1'); await first.enqueue('two', '2'); await first.enqueue('three', '3');
  const online = new MockChatService(server); const restarted = new ChatSyncEngine(new InMemoryClientRepository(disk), online);
  const recovered = await restarted.hydrate();
  expect(recovered.map(m => m.text)).toEqual(['one', 'two', 'three']);
  expect(recovered.every(m => m.deliveryState === 'pending')).toBe(true);
  await restarted.sync();
  const sent = await new InMemoryClientRepository(disk).list();
  expect(sent.map(m => m.serverSequence)).toEqual([1, 2, 3]);
  expect(sent.every(m => m.deliveryState === 'sent')).toBe(true);
});
