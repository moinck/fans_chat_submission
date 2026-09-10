import { SQLiteDatabase } from 'expo-sqlite';

/** Persists the mock online/offline flag across process restarts. */
export class SQLiteSettingsRepository {
  constructor(private db: SQLiteDatabase) {}

  async getOnline(): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ online_mode: number }>(
      'SELECT online_mode FROM app_settings WHERE singleton=1',
    );
    // Default to true on a fresh install (row will exist due to INSERT OR IGNORE in migration)
    return row ? row.online_mode !== 0 : true;
  }

  async setOnline(online: boolean): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO app_settings VALUES (1, ?)',
      online ? 1 : 0,
    );
  }
}
