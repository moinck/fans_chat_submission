import { create } from 'zustand';
import { ClientMessage } from '../domain/message';
import { Entitlement, initialEntitlement } from '../domain/entitlement';
import { ConfirmationMode, PurchaseOutcome, PurchaseState } from '../domain/purchase';
import { SendMode } from '../services/mockChatService';

type AppState = {
  ready: boolean; online: boolean; messages: ClientMessage[]; purchaseState: PurchaseState;
  entitlement: Entitlement; notice: string; sendMode: SendMode; purchaseOutcome: PurchaseOutcome; confirmationMode: ConfirmationMode;
  set: (patch: Partial<Omit<AppState, 'set'>>) => void;
};
export const useAppStore = create<AppState>(set => ({
  ready: false, online: true, messages: [], purchaseState: 'idle', entitlement: initialEntitlement,
  notice: '', sendMode: 'success', purchaseOutcome: 'success', confirmationMode: 'immediate',
  set: patch => set(patch),
}));
