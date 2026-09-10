import { Entitlement } from '../domain/entitlement';

export interface EntitlementRepository {
  get(): Promise<Entitlement>;
  saveIfNewer(entitlement: Entitlement): Promise<Entitlement>;
  hasProcessedTransaction(transactionId: string): Promise<boolean>;
  markTransactionProcessed(transactionId: string): Promise<void>;
  clear(): Promise<void>;
}
