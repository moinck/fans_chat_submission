import { SQLiteDatabase } from 'expo-sqlite';
import { PurchaseEvent } from '../domain/purchase';

/** Persists the mock purchase history so restore works across process restarts. */
export class SQLitePurchaseHistoryRepository {
  constructor(private db: SQLiteDatabase) {}

  async list(): Promise<PurchaseEvent[]> {
    const rows = await this.db.getAllAsync<{
      transaction_id: string;
      product_id: string;
      purchased_at: number;
    }>('SELECT * FROM mock_purchases ORDER BY purchased_at');
    return rows.map(r => ({
      transactionId: r.transaction_id,
      productId: r.product_id,
      purchasedAt: r.purchased_at,
    }));
  }

  async add(event: PurchaseEvent): Promise<void> {
    await this.db.runAsync(
      'INSERT OR IGNORE INTO mock_purchases VALUES (?, ?, ?)',
      event.transactionId,
      event.productId,
      event.purchasedAt,
    );
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM mock_purchases');
  }
}
