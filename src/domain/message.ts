import { z } from 'zod';

export const deliveryStateSchema = z.enum([
  'pending', 'sending', 'sent', 'failed-retryable', 'failed-terminal',
]);
export type DeliveryState = z.infer<typeof deliveryStateSchema>;

export const messageSchema = z.object({
  clientId: z.string().min(1),
  serverId: z.string().nullable(),
  text: z.string().trim().min(1).max(2000),
  createdLocallyAt: z.number().int(),
  serverSequence: z.number().int().positive().nullable(),
  deliveryState: deliveryStateSchema,
  attemptCount: z.number().int().nonnegative(),
  lastErrorCode: z.string().nullable(),
  author: z.enum(['me', 'creator']),
});
export type ClientMessage = z.infer<typeof messageSchema>;
export type ServerMessage = ClientMessage & { serverId: string; serverSequence: number; deliveryState: 'sent' };

export const sortMessages = (messages: ClientMessage[]): ClientMessage[] =>
  [...messages].sort((a, b) => {
    const aConfirmed = a.serverSequence !== null;
    const bConfirmed = b.serverSequence !== null;
    if (aConfirmed && bConfirmed) return a.serverSequence! - b.serverSequence!;
    if (aConfirmed !== bConfirmed) return aConfirmed ? -1 : 1;
    return a.createdLocallyAt - b.createdLocallyAt || a.clientId.localeCompare(b.clientId);
  });

export const mergeMessages = (current: ClientMessage[], incoming: ClientMessage[]): ClientMessage[] => {
  const byClientId = new Map(current.map(message => [message.clientId, message]));
  for (const message of incoming) {
    const parsed = messageSchema.parse(message);
    const existing = byClientId.get(parsed.clientId);
    if (!existing || parsed.serverSequence !== null || existing.serverSequence === null) {
      byClientId.set(parsed.clientId, { ...existing, ...parsed });
    }
  }
  return sortMessages([...byClientId.values()]);
};
