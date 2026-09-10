import { ClientMessage } from '../domain/message';

export interface ClientMessageRepository {
  enqueue(message: ClientMessage): Promise<void>;
  upsert(message: ClientMessage): Promise<void>;
  get(clientId: string): Promise<ClientMessage | null>;
  list(limit?: number): Promise<ClientMessage[]>;
  listBefore(serverSequence: number, limit?: number): Promise<ClientMessage[]>;
  listOutbox(): Promise<ClientMessage[]>;
  clear(): Promise<void>;
}
