import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ClientMessage } from '../domain/message';
import { MessageBubble } from './MessageBubble';

type Props = {
  messages: ClientMessage[];
  onRetry: (id: string) => void;
  onLoadOlder: () => void;
};

/**
 * Renders messages with the newest at the bottom (standard chat UI).
 *
 * Implementation notes:
 * - Data stays ascending (oldest → newest) — the natural sort order from the store.
 * - `initialScrollIndex` is set to the last item so the list opens pinned to the
 *   newest message (message 50,000 after seed) without any programmatic scroll.
 * - `onStartReached` fires when the user scrolls UP toward older messages.
 *   Threshold is set to 0 (fires only when the user actually reaches the very top),
 *   preventing premature older-page loads on initial render.
 */
export const MessageList = ({ messages, onRetry, onLoadOlder }: Props) => {
  const render = useCallback(
    ({ item }: { item: ClientMessage }) => (
      <MessageBubble
        id={item.clientId}
        text={item.text}
        author={item.author}
        state={item.deliveryState}
        error={item.lastErrorCode}
        onRetry={onRetry}
      />
    ),
    [onRetry],
  );

  const lastIndex = messages.length > 0 ? messages.length - 1 : undefined;

  return (
    <FlashList
      data={messages}
      renderItem={render}
      keyExtractor={item => item.clientId}
      // Open at the newest message (bottom of the ascending list)
      initialScrollIndex={lastIndex}
      // Load older messages only when the user actually reaches the top
      onStartReached={onLoadOlder}
      onStartReachedThreshold={0}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.title}>Start the conversation</Text>
          <Text style={styles.copy}>
            Messages you send offline will be delivered when you reconnect.
          </Text>
        </View>
      }
      contentContainerStyle={styles.content}
    />
  );
};

const styles = StyleSheet.create({
  content: { paddingVertical: 12 },
  empty: { padding: 30, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#292333' },
  copy: { marginTop: 8, textAlign: 'center', color: '#716879', lineHeight: 20 },
});
