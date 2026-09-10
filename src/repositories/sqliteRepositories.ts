import * as Crypto from 'expo-crypto';
import { SQLiteDatabase } from 'expo-sqlite';
import { ClientMessage, messageSchema, ServerMessage, sortMessages } from '../domain/message';
import { Entitlement, entitlementSchema, initialEntitlement } from '../domain/entitlement';
import { ClientMessageRepository } from './clientMessageRepository';
import { MockServerRepository } from './mockServerRepository';
import { EntitlementRepository } from './entitlementRepository';

type ClientRow = { client_id: string; server_id: string | null; text: string; created_at: number; server_sequence: number | null; delivery_state: string; attempt_count: number; last_error_code: string | null; author: string };
type ServerRow = { client_id: string; server_id: string; text: string; created_at: number; server_sequence: number; author: string };
const clientFromRow = (r: ClientRow): ClientMessage => messageSchema.parse({ clientId: r.client_id, serverId: r.server_id, text: r.text, createdLocallyAt: r.created_at, serverSequence: r.server_sequence, deliveryState: r.delivery_state, attemptCount: r.attempt_count, lastErrorCode: r.last_error_code, author: r.author });
const serverFromRow = (r: ServerRow): ServerMessage => ({ ...clientFromRow({ ...r, delivery_state: 'sent', attempt_count: 0, last_error_code: null }), serverId: r.server_id, serverSequence: r.server_sequence, deliveryState: 'sent' });

// Serialize every explicit transaction on the shared native connection. Starting
// two expo-sqlite transactions concurrently causes nested-BEGIN errors, while using
// separate exclusive connections can produce SQLITE_BUSY during large bulk seeds.
let transactionQueue: Promise<void> = Promise.resolve();
const runTransaction = async (db: SQLiteDatabase, task: (txn: SQLiteDatabase) => Promise<void>) => {
  const run = transactionQueue.then(() => db.withTransactionAsync(() => task(db)));
  transactionQueue = run.catch(() => undefined);
  return run;
};

export class SQLiteClientMessageRepository implements ClientMessageRepository {
  constructor(private db: SQLiteDatabase) {}
  async enqueue(message: ClientMessage) {
    const m = messageSchema.parse(message);
    await this.db.runAsync('INSERT INTO client_messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', m.clientId, m.serverId, m.text, m.createdLocallyAt, m.serverSequence, m.deliveryState, m.attemptCount, m.lastErrorCode, m.author);
  }
  async upsert(message: ClientMessage) {
    const m = messageSchema.parse(message);
    await this.db.runAsync(`INSERT INTO client_messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET server_id=excluded.server_id,text=excluded.text,server_sequence=excluded.server_sequence,delivery_state=excluded.delivery_state,attempt_count=excluded.attempt_count,last_error_code=excluded.last_error_code,author=excluded.author`, m.clientId, m.serverId, m.text, m.createdLocallyAt, m.serverSequence, m.deliveryState, m.attemptCount, m.lastErrorCode, m.author);
  }
  async get(clientId: string) { const row = await this.db.getFirstAsync<ClientRow>('SELECT * FROM client_messages WHERE client_id=?', clientId); return row ? clientFromRow(row) : null; }
  async list(limit = 100) { const rows = await this.db.getAllAsync<ClientRow>('SELECT * FROM client_messages ORDER BY CASE WHEN server_sequence IS NULL THEN 1 ELSE 0 END DESC, server_sequence DESC, created_at DESC LIMIT ?', limit); return sortMessages(rows.map(clientFromRow)); }
  async listBefore(sequence: number, limit = 50) { const rows = await this.db.getAllAsync<ClientRow>('SELECT * FROM client_messages WHERE server_sequence < ? ORDER BY server_sequence DESC LIMIT ?', sequence, limit); return sortMessages(rows.map(clientFromRow)); }
  async listOutbox() { const rows = await this.db.getAllAsync<ClientRow>("SELECT * FROM client_messages WHERE author='me' AND delivery_state != 'sent' ORDER BY created_at, client_id"); return rows.map(clientFromRow); }
  async clear() { await this.db.runAsync('DELETE FROM client_messages'); }
  async seed(count: number) {
    await runTransaction(this.db, async txn => {
      await txn.runAsync(`WITH RECURSIVE counter(i) AS (
        SELECT 1 UNION ALL SELECT i + 1 FROM counter WHERE i < ?
      ) INSERT OR IGNORE INTO client_messages
        (client_id, server_id, text, created_at, server_sequence, delivery_state, attempt_count, last_error_code, author)
        SELECT 'seed-' || i, 'server-seed-' || i, 'History message ' || printf('%05d', i),
          1700000000000 + i * 1000, i, 'sent', 0, NULL,
          CASE WHEN i % 3 = 0 THEN 'me' ELSE 'creator' END
        FROM counter`, count);
    });
  }
}

export class SQLiteMockServerRepository implements MockServerRepository {
  constructor(private db: SQLiteDatabase) {}
  async accept(clientId: string, text: string, author: 'me' | 'creator' = 'me'): Promise<ServerMessage> {
    let result: ServerMessage | undefined;
    await runTransaction(this.db, async txn => {
      const existing = await txn.getFirstAsync<ServerRow>('SELECT * FROM server_messages WHERE client_id=?', clientId);
      if (existing) { result = serverFromRow(existing); return; }
      const next = await txn.getFirstAsync<{ next: number }>('SELECT COALESCE(MAX(server_sequence), 0) + 1 AS next FROM server_messages');
      const row: ServerRow = { client_id: clientId, server_id: Crypto.randomUUID(), text, created_at: Date.now(), server_sequence: next?.next ?? 1, author };
      await txn.runAsync('INSERT INTO server_messages VALUES (?, ?, ?, ?, ?, ?)', row.server_id, row.client_id, row.text, row.server_sequence, row.created_at, row.author);
      result = serverFromRow(row);
    });
    if (!result) throw new Error('Server transaction did not produce a message');
    return result;
  }
  async listAfter(sequence: number, limit = 100) { const rows = await this.db.getAllAsync<ServerRow>('SELECT * FROM server_messages WHERE server_sequence > ? ORDER BY server_sequence LIMIT ?', sequence, limit); return rows.map(serverFromRow); }
  async countByClientId(clientId: string) { const row = await this.db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM server_messages WHERE client_id=?', clientId); return row?.count ?? 0; }
  async clear() { await this.db.runAsync('DELETE FROM server_messages'); }
  async seed(count: number) {
    const current = await this.db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM server_messages WHERE client_id LIKE 'seed-%'");
    if ((current?.count ?? 0) >= count) return;
    await runTransaction(this.db, async txn => {
      await txn.runAsync(`WITH RECURSIVE counter(i) AS (
        SELECT 1 UNION ALL SELECT i + 1 FROM counter WHERE i < ?
      ) INSERT OR IGNORE INTO server_messages
        (server_id, client_id, text, server_sequence, created_at, author)
        SELECT 'server-seed-' || i, 'seed-' || i, 'History message ' || printf('%05d', i),
          i, 1700000000000 + i * 1000,
          CASE WHEN i % 3 = 0 THEN 'me' ELSE 'creator' END
        FROM counter`, count);
    });
  }
}

export class SQLiteEntitlementRepository implements EntitlementRepository {
  constructor(private db: SQLiteDatabase) {}
  async get() { const row = await this.db.getFirstAsync<{ status: string; product_id: string; confirmed_at: number | null; expires_at: number | null; version: number }>('SELECT * FROM entitlement WHERE singleton=1'); return row ? entitlementSchema.parse({ status: row.status, productId: row.product_id, confirmedAt: row.confirmed_at, expiresAt: row.expires_at, version: row.version }) : initialEntitlement; }
  async saveIfNewer(e: Entitlement) { const value = entitlementSchema.parse(e); const current = await this.get(); if (value.version < current.version) return current; await this.db.runAsync('INSERT OR REPLACE INTO entitlement VALUES (1, ?, ?, ?, ?, ?)', value.status, value.productId, value.confirmedAt, value.expiresAt, value.version); return value; }
  async hasProcessedTransaction(id: string) { return !!(await this.db.getFirstAsync('SELECT 1 FROM processed_transactions WHERE transaction_id=?', id)); }
  async markTransactionProcessed(id: string) { await this.db.runAsync('INSERT OR IGNORE INTO processed_transactions VALUES (?, ?)', id, Date.now()); }
  async clear() { await this.db.execAsync('DELETE FROM entitlement; DELETE FROM processed_transactions;'); }
}
