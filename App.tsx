import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatComposer } from './src/components/ChatComposer';
import { DebugControls } from './src/components/DebugControls';
import { MessageList } from './src/components/MessageList';
import { Paywall } from './src/components/Paywall';
import { StatusBanner } from './src/components/StatusBanner';
import { getDatabase } from './src/db/database';
import { SQLiteClientMessageRepository, SQLiteEntitlementRepository, SQLiteMockServerRepository } from './src/repositories/sqliteRepositories';
import { SQLitePurchaseHistoryRepository } from './src/repositories/sqlitePurchaseHistoryRepository';
import { SQLiteSettingsRepository } from './src/repositories/sqliteSettingsRepository';
import { ChatSyncEngine } from './src/services/chatSyncEngine';
import { MockChatService } from './src/services/mockChatService';
import { MockEntitlementBackend } from './src/services/mockEntitlementBackend';
import { MockPurchaseService } from './src/services/mockPurchaseService';
import { PurchaseCoordinator } from './src/services/purchaseCoordinator';
import { useAppStore } from './src/state/appStore';

type Runtime = {
  client: SQLiteClientMessageRepository;
  server: SQLiteMockServerRepository;
  entitlement: SQLiteEntitlementRepository;
  purchaseHistory: SQLitePurchaseHistoryRepository;
  settings: SQLiteSettingsRepository;
  chat: MockChatService;
  engine: ChatSyncEngine;
  store: MockPurchaseService;
  backend: MockEntitlementBackend;
  purchases: PurchaseCoordinator;
};

const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('locked') || message.includes('transaction')) return 'The local database is busy. Wait a moment and try again.';
  return 'That operation could not be completed. Please try again.';
};
const runSafely = (work: Promise<unknown>) => { void work.catch(error => useAppStore.getState().set({ notice: friendlyError(error) })); };

function ChatApp() {
  const state = useAppStore(); const runtime = useRef<Runtime | null>(null);
  useEffect(() => { let mounted = true; (async () => {
    try {
      const db = await getDatabase();
      const client = new SQLiteClientMessageRepository(db);
      const server = new SQLiteMockServerRepository(db);
      const entitlement = new SQLiteEntitlementRepository(db);
      const purchaseHistory = new SQLitePurchaseHistoryRepository(db);
      const settings = new SQLiteSettingsRepository(db);

      // Issue 3: read persisted online flag before constructing services
      const persistedOnline = await settings.getOnline();

      const chat = new MockChatService(server);
      chat.online = persistedOnline; // honour persisted offline state immediately

      const store = new MockPurchaseService(purchaseHistory);
      const backend = new MockEntitlementBackend();
      const engine = new ChatSyncEngine(client, chat, messages => mounted && useAppStore.getState().set({ messages }));
      const purchases = new PurchaseCoordinator(store, backend, entitlement, (purchaseState, access, notice='') => mounted && useAppStore.getState().set({ purchaseState, entitlement: access, notice }));
      runtime.current = { client, server, entitlement, purchaseHistory, settings, chat, engine, store, backend, purchases };

      await engine.hydrate();
      useAppStore.getState().set({ entitlement: await entitlement.get(), online: persistedOnline, ready: true });

      // Issue 3: only sync on startup if the persisted state is online
      if (persistedOnline) await engine.sync();
    } catch (error) { Alert.alert('Could not start', error instanceof Error ? error.message : 'Unknown database error'); }
  })(); return () => { mounted = false; }; }, []);

  const send = useCallback(async (text:string) => { const r=runtime.current; if(!r)return; r.chat.nextMode=useAppStore.getState().sendMode; useAppStore.getState().set({sendMode:'success'}); try { await r.engine.enqueue(text); } catch (error) { useAppStore.getState().set({ notice: `Send failed: ${error instanceof Error ? error.message : 'Unknown error'}` }); } },[]);
  const retry = useCallback((id:string)=>{const work=runtime.current?.engine.retry(id);if(work)runSafely(work)},[]);

  const toggleOnline = useCallback(() => {
    const r = runtime.current; if (!r) return;
    const online = !r.chat.online;
    r.chat.online = online;
    // Issue 3: persist the new online state so it survives restart
    void r.settings.setOnline(online);
    useAppStore.getState().set({ online, notice: online ? 'Connection restored' : 'Offline mode active' });
    if (online) runSafely(r.engine.sync());
  }, []);

  const purchase=useCallback(()=>{const r=runtime.current;if(!r)return;const s=useAppStore.getState();r.store.outcome=s.purchaseOutcome;r.backend.mode=s.confirmationMode;runSafely(r.purchases.purchase())},[]);
  const restore=useCallback(()=>{const work=runtime.current?.purchases.restore();if(work)runSafely(work)},[]);
  const inject=useCallback(()=>{const work=runtime.current?.chat.injectIncoming(4).then(()=>useAppStore.getState().set({notice:'4 remote messages waiting on mock server.'}));if(work)runSafely(work)},[]);
  const seed=useCallback(()=>{const r=runtime.current;if(!r)return;useAppStore.getState().set({notice:'Seeding 50,000 messages…'});runSafely((async()=>{await r.client.clear();await r.server.clear();await r.server.seed(50000);await r.client.seed(50000);await r.engine.hydrate();useAppStore.getState().set({notice:'50,000 messages seeded into local database.'})})())},[]);
  const resetClient=useCallback(()=>{const r=runtime.current;if(!r)return;runSafely(r.client.clear().then(()=>r.engine.hydrate()).then(()=>useAppStore.getState().set({notice:'Client messages cleared.'})))},[]);
  const resetServer=useCallback(()=>{const work=runtime.current?.server.clear().then(()=>useAppStore.getState().set({notice:'Mock server messages cleared.'}));if(work)runSafely(work)},[]);

  // Issue 5: Reset All now resets ALL in-memory service state, config modes, and DB tables
  const resetAll = useCallback(() => {
    const r = runtime.current; if (!r) return;
    runSafely((async () => {
      // 1. Clear all database tables
      await r.client.clear();
      await r.server.clear();
      await r.entitlement.clear();
      await r.purchaseHistory.clear();

      // 2. Reset in-memory service state to defaults
      r.chat.online = true;
      r.chat.nextMode = 'success';
      r.store.outcome = 'success';
      await r.store.resetPurchases();
      r.backend.mode = 'immediate';
      // Drain any pending delayed confirmations by resolving them harmlessly
      r.backend.confirmPending();

      // 3. Persist the reset online=true state
      await r.settings.setOnline(true);

      // 4. Reload hydrated messages and entitlement
      await r.engine.hydrate();

      // 5. Reset ALL Zustand store slices to initial defaults
      useAppStore.getState().set({
        entitlement: await r.entitlement.get(),
        purchaseState: 'idle',
        online: true,
        sendMode: 'success',
        purchaseOutcome: 'success',
        confirmationMode: 'immediate',
        notice: 'All state wiped — fully reset to defaults.',
      });
    })());
  }, []);

  if(!state.ready)return <SafeAreaView style={styles.loading}><ActivityIndicator color="#53B5F7"/><Text style={styles.loadingText}>Opening secure outbox…</Text></SafeAreaView>;
  const active=state.entitlement.status==='active' && (!state.entitlement.expiresAt || state.entitlement.expiresAt>Date.now());
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
            }}
            style={styles.avatar}
          />
          <View
            style={[
              styles.avatarBadge,
              { backgroundColor: state.online ? '#35C57A' : '#B8B0C4' },
            ]}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.name}>Luna Vale</Text>
          <Text style={styles.subtitle}>
            {state.online ? 'Online now' : 'Reconnect to deliver'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings and info"
          onPress={() => {
            Alert.alert(
              'Luna Vale — Fan Chat',
              `• Status: ${state.online ? 'Online' : 'Offline'}\n• Subscription: ${active ? 'Active (VIP)' : 'Not Subscribed'}\n\nTap "Demo & Test Controls" at the bottom to simulate purchases, network faults, or 50k messages.`,
              [{ text: 'OK' }]
            );
          }}
          style={({ pressed }) => [
            styles.settingsBtn,
            pressed && styles.settingsBtnPressed,
          ]}
        >
          <Text style={styles.settingsIconText}>⚙️</Text>
        </Pressable>
      </View>
      <StatusBanner online={state.online} notice={state.notice} />
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {!active && (
          <Paywall
            state={state.purchaseState}
            onPurchase={purchase}
            onRestore={restore}
          />
        )}
        <View style={styles.list}>
          <MessageList
            messages={state.messages}
            onRetry={retry}
            onLoadOlder={() => {
              const work = runtime.current?.engine.loadOlder();
              if (work) runSafely(work);
            }}
          />
        </View>
        <ChatComposer disabled={!active} onSend={send} />
      </KeyboardAvoidingView>
      <DebugControls
        online={state.online}
        sendMode={state.sendMode}
        purchaseOutcome={state.purchaseOutcome}
        confirmationMode={state.confirmationMode}
        onOnline={toggleOnline}
        onSync={() => {
          const work = runtime.current?.engine
            .sync()
            .then(() =>
              useAppStore.getState().set({ notice: 'Messages synchronized.' })
            );
          if (work) runSafely(work);
        }}
        onInject={inject}
        onSeed={seed}
        onSendMode={sendMode =>
          state.set({ sendMode, notice: `Next send mode set to: ${sendMode}` })
        }
        onPurchaseOutcome={purchaseOutcome =>
          state.set({
            purchaseOutcome,
            notice: `Next purchase simulated outcome: ${purchaseOutcome}`,
          })
        }
        onConfirmationMode={confirmationMode =>
          state.set({
            confirmationMode,
            notice: `Backend confirmation mode: ${confirmationMode}`,
          })
        }
        onConfirm={() => {
          runtime.current?.backend.confirmPending();
          useAppStore
            .getState()
            .set({ notice: 'Confirmed pending backend access.' });
        }}
        onExpire={() => {
          const work = runtime.current?.purchases
            .applyStatus('expired')
            .then(() =>
              useAppStore
                .getState()
                .set({ notice: 'Subscription marked as EXPIRED.' })
            );
          if (work) runSafely(work);
        }}
        onRefund={() => {
          const work = runtime.current?.purchases
            .applyStatus('refunded')
            .then(() =>
              useAppStore
                .getState()
                .set({ notice: 'Subscription marked as REFUNDED.' })
            );
          if (work) runSafely(work);
        }}
        onResetClient={resetClient}
        onResetServer={resetServer}
        onResetAll={resetAll}
      />
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <ChatApp />
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#6F6678' },
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDD6E5',
    backgroundColor: '#FFF',
  },
  avatarContainer: { position: 'relative', width: 44, height: 44 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D7EEFD' },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  headerCopy: { flex: 1, marginLeft: 12 },
  name: { fontSize: 17, fontWeight: '800', color: '#211C2B' },
  subtitle: { fontSize: 12, color: '#6F6678', marginTop: 2 },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0F8FE',
    borderWidth: 1,
    borderColor: '#D3ECFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnPressed: { backgroundColor: '#E1F2FD', transform: [{ scale: 0.95 }] },
  settingsIconText: { fontSize: 17 },
  body: { flex: 1 },
  list: { flex: 1 },
});
