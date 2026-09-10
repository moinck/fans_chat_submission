import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DeliveryState } from '../domain/message';

type Props = { id: string; text: string; author: 'me' | 'creator'; state: DeliveryState; error: string | null; onRetry: (id: string) => void };
const labels: Record<DeliveryState, string> = { pending: 'Waiting for connection', sending: 'Sending', sent: 'Delivered', 'failed-retryable': 'Not sent — tap Retry', 'failed-terminal': 'Could not send — edit and resend' };
export const MessageBubble = memo(({ id, text, author, state, error, onRetry }: Props) => {
  const mine = author === 'me'; const retryable = state === 'failed-retryable';
  return <View style={[styles.row, mine ? styles.mineRow : styles.theirRow]}>
    <View accessible accessibilityLabel={`${mine ? 'You' : 'Creator'}: ${text}. ${mine ? labels[state] : ''}`} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Text style={[styles.text, mine && styles.mineText]}>{text}</Text>
      {mine && <View style={styles.statusRow}><Text style={[styles.status, mine && styles.mineStatus]}>{labels[state]}</Text>{retryable && <Pressable accessibilityRole="button" accessibilityLabel={`Retry message: ${text}`} hitSlop={10} onPress={() => onRetry(id)}><Text style={styles.retry}>Retry</Text></Pressable>}</View>}
      {state === 'failed-terminal' && <Text style={styles.error}>Content was rejected. Copy, edit, and send again. ({error})</Text>}
    </View>
  </View>;
});
const styles = StyleSheet.create({ row:{ paddingHorizontal:16, paddingVertical:4, flexDirection:'row' }, mineRow:{ justifyContent:'flex-end' }, theirRow:{ justifyContent:'flex-start' }, bubble:{ maxWidth:'82%', borderRadius:20, paddingHorizontal:14, paddingVertical:10 }, mine:{ backgroundColor:'#53B5F7', borderBottomRightRadius:5 }, theirs:{ backgroundColor:'#F0EDF7', borderBottomLeftRadius:5 }, text:{ color:'#211C2B', fontSize:16, lineHeight:21 }, mineText:{ color:'white' }, statusRow:{ flexDirection:'row', alignItems:'center', justifyContent:'flex-end', marginTop:4, gap:10 }, status:{ fontSize:11, color:'#665E70' }, mineStatus:{ color:'#EBF6FE' }, retry:{ color:'#FFF', fontSize:12, fontWeight:'800', textDecorationLine:'underline' }, error:{ color:'#FFE1E1', fontSize:11, marginTop:5 } });
