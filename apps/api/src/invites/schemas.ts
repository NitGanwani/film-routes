import { z } from 'zod';

/** An invitation link stops working after this long unless the author says otherwise. */
export const DEFAULT_INVITE_EXPIRY_DAYS = 30;

export const inviteParamsSchema = z.object({
  routeId: z.uuid(),
  inviteId: z.uuid(),
});

/**
 * `maxUses` left out or null means unlimited. `expiresInDays` left out means
 * the default; null means the link never expires.
 */
export const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(10_000).nullable().optional(),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(1).max(256),
});

export type CreateInviteInput = z.output<typeof createInviteSchema>;
