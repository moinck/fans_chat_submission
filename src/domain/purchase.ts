export type PurchaseState =
  | 'idle' | 'purchasing' | 'purchased-awaiting-confirmation'
  | 'cancelled' | 'failed' | 'restoring';
export type PurchaseOutcome = 'success' | 'cancel' | 'fail';
export type ConfirmationMode = 'immediate' | 'delayed' | 'reject';
export type PurchaseEvent = { transactionId: string; productId: string; purchasedAt: number };
