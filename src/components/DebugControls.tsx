import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ConfirmationMode, PurchaseOutcome } from '../domain/purchase';
import { SendMode } from '../services/mockChatService';

type Props = {
  online: boolean;
  sendMode: SendMode;
  purchaseOutcome: PurchaseOutcome;
  confirmationMode: ConfirmationMode;
  onOnline: () => void;
  onSendMode: (v: SendMode) => void;
  onPurchaseOutcome: (v: PurchaseOutcome) => void;
  onConfirmationMode: (v: ConfirmationMode) => void;
  onInject: () => void;
  onSeed: () => void;
  onSync: () => void;
  onConfirm: () => void;
  onExpire: () => void;
  onRefund: () => void;
  onResetClient: () => void;
  onResetServer: () => void;
  onResetAll: () => void;
};

// Mode switch chip (Radio selector)
const ModeChip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    style={({ pressed }) => [
      styles.chip,
      selected && styles.chipSelected,
      pressed && styles.pressed,
    ]}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {selected ? `✓ ${label}` : label}
    </Text>
  </Pressable>
);

// Trigger action button (Runs immediately)
const ActionButton = ({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
  >
    <Text style={styles.actionText}>
      {icon ? `${icon}  ${label}` : label}
    </Text>
  </Pressable>
);

// Danger / destructive button (State reset or override)
const DangerButton = ({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
  >
    <Text style={styles.dangerText}>
      {icon ? `${icon}  ${label}` : label}
    </Text>
  </Pressable>
);

export const DebugControls = (props: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.shell}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(v => !v)}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.dot,
              { backgroundColor: props.online ? '#35C57A' : '#E09724' },
            ]}
          />
          <Text style={styles.headerText}>Demo & Test Controls</Text>
        </View>
        <Text style={styles.toggleIcon}>{open ? '▴ Hide' : '▾ Open'}</Text>
      </Pressable>

      {open && (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.content}
          nestedScrollEnabled
        >
          {/* Section 1: Instant Network & Chat Actions */}
          <Text style={styles.categoryTitle}>⚡ ACTIONS (Run Immediately)</Text>
          <View style={styles.row}>
            <ActionButton
              label={props.online ? 'Go Offline' : 'Go Online'}
              icon={props.online ? '📴' : '📶'}
              onPress={props.onOnline}
            />
            <ActionButton label="Sync Now" icon="🔄" onPress={props.onSync} />
            <ActionButton
              label="Inject 4 Incoming"
              icon="💬"
              onPress={props.onInject}
            />
            <ActionButton
              label="Seed 50,000 Rows"
              icon="📦"
              onPress={props.onSeed}
            />
            <ActionButton
              label="Confirm Pending"
              icon="✅"
              onPress={props.onConfirm}
            />
          </View>

          {/* Section 2: Mode Selectors */}
          <Text style={styles.categoryTitle}>
            🎯 CONFIG: Next Send Delivery Mode
          </Text>
          <Text style={styles.hint}>Selects behavior for the next message you send</Text>
          <View style={styles.row}>
            {(
              [
                'success',
                'lost-response',
                'retryable-failure',
                'terminal-failure',
              ] as SendMode[]
            ).map(v => (
              <ModeChip
                key={v}
                label={v}
                selected={props.sendMode === v}
                onPress={() => props.onSendMode(v)}
              />
            ))}
          </View>

          <Text style={styles.categoryTitle}>
            🎯 CONFIG: Next Purchase Simulation
          </Text>
          <Text style={styles.hint}>
            Selects result for next time you tap "Subscribe"
          </Text>
          <View style={styles.row}>
            {(['success', 'cancel', 'fail'] as PurchaseOutcome[]).map(v => (
              <ModeChip
                key={v}
                label={`Outcome: ${v}`}
                selected={props.purchaseOutcome === v}
                onPress={() => props.onPurchaseOutcome(v)}
              />
            ))}
          </View>

          <Text style={styles.categoryTitle}>
            🎯 CONFIG: Backend Confirmation Mode
          </Text>
          <Text style={styles.hint}>
            Delayed stays pending until "Confirm Pending" is pressed
          </Text>
          <View style={styles.row}>
            {(['immediate', 'delayed', 'reject'] as ConfirmationMode[]).map(
              v => (
                <ModeChip
                  key={v}
                  label={v}
                  selected={props.confirmationMode === v}
                  onPress={() => props.onConfirmationMode(v)}
                />
              )
            )}
          </View>

          {/* Section 3: Subscription Overrides */}
          <Text style={styles.categoryTitle}>
            ⚠️ SUBSCRIPTION OVERRIDES (Immediate)
          </Text>
          <View style={styles.row}>
            <DangerButton
              label="Force Expire Subscription"
              icon="⏰"
              onPress={props.onExpire}
            />
            <DangerButton
              label="Simulate Refund & Revoke"
              icon="💸"
              onPress={props.onRefund}
            />
          </View>

          {/* Section 4: Resets */}
          <Text style={styles.categoryTitle}>
            🗑️ DATABASE RESETS (Immediate)
          </Text>
          <View style={styles.row}>
            <DangerButton
              label="Reset Client Only"
              icon="🧹"
              onPress={props.onResetClient}
            />
            <DangerButton
              label="Reset Server Only"
              icon="🧹"
              onPress={props.onResetServer}
            />
            <DangerButton
              label="Reset All (Wipe)"
              icon="🔥"
              onPress={props.onResetAll}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  shell: { backgroundColor: '#202A38', borderTopWidth: 1, borderColor: '#33435C' },
  header: {
    height: 42,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1B2330',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { color: '#F1F5F9', fontSize: 13, fontWeight: '700' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  toggleIcon: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  panel: { maxHeight: 320, backgroundColor: '#202A38' },
  content: { padding: 14, paddingTop: 4, paddingBottom: 24 },
  categoryTitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 4,
  },
  hint: { color: '#94A3B8', fontSize: 10, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // Mode Chips
  chip: {
    backgroundColor: '#2B384B',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#3D4F6A',
  },
  chipSelected: {
    backgroundColor: '#53B5F7',
    borderColor: '#93D5FE',
  },
  chipText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '700' },

  // Action Buttons
  actionButton: {
    backgroundColor: '#34445A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#475C7A',
  },
  actionText: { color: '#F8FAFC', fontSize: 11, fontWeight: '600' },

  // Danger Buttons
  dangerButton: {
    backgroundColor: '#4A2A33',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#6C3B47',
  },
  dangerText: { color: '#FFC0CB', fontSize: 11, fontWeight: '600' },

  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});

