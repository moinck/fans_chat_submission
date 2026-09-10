import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const ChatComposer = ({
  disabled,
  onSend,
  onSubscribe,
}: {
  disabled: boolean;
  onSend: (text: string) => Promise<void>;
  onSubscribe?: () => void;
}) => {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const send = useCallback(async () => {
    if (disabled) {
      if (onSubscribe) {
        onSubscribe();
      } else {
        Alert.alert('Subscribe to chat', 'Unlock creator chat to send messages.');
      }
      return;
    }
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onSend(text);
      setDraft('');
    } finally {
      setBusy(false);
    }
  }, [disabled, draft, busy, onSend, onSubscribe]);

  const sendDisabled = busy || (!disabled && !draft.trim());

  return (
    <View style={styles.row}>
      <TextInput
        accessibilityLabel="Message"
        placeholder={disabled ? 'Write a message…' : 'Write a message…'}
        placeholderTextColor="#81788C"
        value={draft}
        onChangeText={setDraft}
        editable={true}
        multiline
        maxLength={2000}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        disabled={sendDisabled}
        onPress={() => void send()}
        style={({ pressed }) => [
          styles.button,
          sendDisabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.send}>↑</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#DED8E8', backgroundColor: '#FFF', gap: 8 },
  input: { flex: 1, maxHeight: 110, minHeight: 44, borderRadius: 22, backgroundColor: '#F4F1F7', paddingHorizontal: 16, paddingVertical: 11, fontSize: 16, color: '#211C2B' },
  button: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#53B5F7', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.96 }] },
  send: { color: '#FFF', fontSize: 25, fontWeight: '700' },
});
