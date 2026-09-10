import { ChatSyncEngine } from '../src/services/chatSyncEngine';
import { MockChatService } from '../src/services/mockChatService';
import { InMemoryClientRepository, InMemoryServerRepository } from '../src/test/inMemoryRepositories';

test('lost response retry reconciles one server message using the same client id', async () => {
  const client = new InMemoryClientRepository(); const server = new InMemoryServerRepository();
  const service = new MockChatService(server); service.online = false;
  const engine = new ChatSyncEngine(client, service); await engine.hydrate();
  await engine.enqueue('hello', 'A'); service.online = true; service.nextMode = 'lost-response';
  await engine.flush();
  expect((await client.get('A'))?.deliveryState).toBe('failed-retryable');
  await engine.retry('A');
  expect(await server.countByClientId('A')).toBe(1);
  expect((await client.get('A'))?.deliveryState).toBe('sent');
  expect((await client.list()).filter(m => m.clientId === 'A')).toHaveLength(1);
});
