import { ServerMessage } from '../domain/message';

export interface MockServerRepository {
  accept(clientId: string, text: string, author?: 'me' | 'creator'): Promise<ServerMessage>;
  listAfter(sequence: number, limit?: number): Promise<ServerMessage[]>;
  countByClientId(clientId: string): Promise<number>;
  clear(): Promise<void>;
}
