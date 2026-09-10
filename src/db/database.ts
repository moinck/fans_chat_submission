import * as SQLite from 'expo-sqlite';
import { migrationSql } from './migrations';

let promise: Promise<SQLite.SQLiteDatabase> | undefined;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!promise) {
    promise = SQLite.openDatabaseAsync('fans-chat.db').then(async db => {
      await db.execAsync(migrationSql);
      return db;
    });
  }
  return promise;
};
