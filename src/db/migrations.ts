export const migrationSql = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 10000;
CREATE TABLE IF NOT EXISTS client_messages (
  client_id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT UNIQUE,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  server_sequence INTEGER,
  delivery_state TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  author TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_sequence ON client_messages(server_sequence);
CREATE INDEX IF NOT EXISTS idx_client_delivery ON client_messages(delivery_state, created_at);
CREATE TABLE IF NOT EXISTS server_messages (
  server_id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  server_sequence INTEGER UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  author TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_server_sequence ON server_messages(server_sequence);
CREATE TABLE IF NOT EXISTS entitlement (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  status TEXT NOT NULL,
  product_id TEXT NOT NULL,
  confirmed_at INTEGER,
  expires_at INTEGER,
  version INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS processed_transactions (
  transaction_id TEXT PRIMARY KEY NOT NULL,
  processed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  online_mode INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO app_settings VALUES (1, 1);
CREATE TABLE IF NOT EXISTS mock_purchases (
  transaction_id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  purchased_at INTEGER NOT NULL
);
`;
