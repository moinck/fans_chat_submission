import { z } from 'zod';

export const entitlementSchema = z.object({
  status: z.enum(['unknown', 'inactive', 'active', 'expired', 'refunded']),
  productId: z.string(),
  confirmedAt: z.number().int().nullable(),
  expiresAt: z.number().int().nullable(),
  version: z.number().int().nonnegative(),
});
export type Entitlement = z.infer<typeof entitlementSchema>;
export const initialEntitlement: Entitlement = {
  status: 'inactive', productId: 'creator.monthly', confirmedAt: null, expiresAt: null, version: 0,
};
