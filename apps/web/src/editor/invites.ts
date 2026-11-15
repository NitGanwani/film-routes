import type { CreateInviteBody, Invite, InviteStatus } from '../api/types.js';

/** What the API accepts for a new link (see `createInviteSchema`). */
export const INVITE_LIMITS = {
  maxUses: 10_000,
  maxDays: 365,
  /** What the API uses when the author says nothing about caducidad. */
  defaultDays: 30,
} as const;

/** The groups of the list, from the ones that still work to the dead ones. */
const STATUS_ORDER: Record<InviteStatus, number> = {
  active: 0,
  exhausted: 1,
  expired: 2,
  revoked: 3,
};

/** Working links first, then used up, expired and revoked; the newest first inside each. */
export function sortInvites(invites: readonly Invite[]): Invite[] {
  return [...invites].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

/** The page a traveler opens with the link. The token is what makes it theirs. */
export const inviteLink = (origin: string, token: string) =>
  `${origin}/invite/${encodeURIComponent(token)}`;

// ---------- The form ----------

export type UsesChoice = 'unlimited' | 'limited';
export type ExpiryChoice = 'default' | 'custom' | 'never';

export type InviteForm = {
  uses: UsesChoice;
  /** Typed text, so an empty or half-typed field is representable. */
  maxUses: string;
  expiry: ExpiryChoice;
  days: string;
};

export const initialInviteForm: InviteForm = {
  uses: 'unlimited',
  maxUses: '1',
  expiry: 'default',
  days: String(INVITE_LIMITS.defaultDays),
};

/** A whole number within the range, from text; null when it is not one. */
function wholeNumber(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return value >= min && value <= max ? value : null;
}

export type InviteFormProblems = { maxUses: boolean; days: boolean };

/** Which of the two numbers is wrong, and only when that choice is the one in use. */
export function inviteFormProblems(form: InviteForm): InviteFormProblems {
  return {
    maxUses:
      form.uses === 'limited' &&
      wholeNumber(form.maxUses, 1, INVITE_LIMITS.maxUses) === null,
    days:
      form.expiry === 'custom' &&
      wholeNumber(form.days, 1, INVITE_LIMITS.maxDays) === null,
  };
}

/** What to send, or null while the form has a problem. */
export function inviteBody(form: InviteForm): CreateInviteBody | null {
  const problems = inviteFormProblems(form);
  if (problems.maxUses || problems.days) return null;
  return {
    maxUses:
      form.uses === 'limited'
        ? wholeNumber(form.maxUses, 1, INVITE_LIMITS.maxUses)
        : null,
    expiresInDays:
      form.expiry === 'never'
        ? null
        : form.expiry === 'custom'
          ? wholeNumber(form.days, 1, INVITE_LIMITS.maxDays)
          : INVITE_LIMITS.defaultDays,
  };
}

/** Keep only the digits of what is typed, so the field can never hold anything else. */
export const digitsOnly = (text: string) => text.replace(/\D/g, '').slice(0, 5);

// ---------- Showing a link ----------

/**
 * A day for the list, in the language of the interface: "12 dic", and with the
 * year when it is not this one.
 */
export function formatDay(iso: string, language: string, now: Date): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}
