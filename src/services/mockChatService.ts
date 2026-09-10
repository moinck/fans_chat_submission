import { ServerMessage } from '../domain/message';
import { MockServerRepository } from '../repositories/mockServerRepository';

export type SendMode = 'success' | 'lost-response' | 'retryable-failure' | 'terminal-failure';
export class ChatServiceError extends Error { constructor(public code: string, public retryable: boolean) { super(code); } }

export class MockChatService {
  online = true;
  nextMode: SendMode = 'success';
  constructor(public readonly repository: MockServerRepository) {}
  async send(clientId: string, text: string): Promise<ServerMessage> {
    if (!this.online) throw new ChatServiceError('OFFLINE', true);
    const mode = this.nextMode; this.nextMode = 'success';
    if (mode === 'retryable-failure') throw new ChatServiceError('SERVER_BUSY', true);
    if (mode === 'terminal-failure') throw new ChatServiceError('CONTENT_REJECTED', false);
    const accepted = await this.repository.accept(clientId, text, 'me');
    if (mode === 'lost-response') throw new ChatServiceError('RESPONSE_LOST', true);
    return accepted;
  }
  async incomingAfter(sequence: number, limit = 100) {
    if (!this.online) throw new ChatServiceError('OFFLINE', true);
    return this.repository.listAfter(sequence, limit);
  }
  async injectIncoming(count = 4) {
    for (let i = 0; i < count; i++) await this.repository.accept(`remote-${Date.now()}-${i}`, `New message from the creator #${i + 1}`, 'creator');
  }
}
