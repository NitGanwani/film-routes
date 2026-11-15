import { describe, expect, it } from 'vitest';
import type { Invite } from '../api/types.js';
import {
  digitsOnly,
  formatDay,
  initialInviteForm,
  inviteBody,
  inviteFormProblems,
  inviteLink,
  sortInvites,
} from './invites.js';

const invite = (change: Partial<Invite>): Invite => ({
  id: 'i',
  maxUses: null,
  usesCount: 0,
  expiresAt: null,
  revokedAt: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  status: 'active',
  ...change,
});

describe('sortInvites', () => {
  it('puts working links first, then used up, expired and revoked', () => {
    const sorted = sortInvites([
      invite({ id: 'revoked', status: 'revoked' }),
      invite({ id: 'expired', status: 'expired' }),
      invite({ id: 'exhausted', status: 'exhausted' }),
      invite({ id: 'active', status: 'active' }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual([
      'active',
      'exhausted',
      'expired',
      'revoked',
    ]);
  });

  it('puts the newest first inside a group, without touching the original', () => {
    const list = [
      invite({ id: 'old', createdAt: '2026-10-01T10:00:00.000Z' }),
      invite({ id: 'new', createdAt: '2026-11-10T10:00:00.000Z' }),
    ];
    expect(sortInvites(list).map((item) => item.id)).toEqual(['new', 'old']);
    expect(list[0]?.id).toBe('old');
  });
});

describe('inviteLink', () => {
  it('is the invite page of the site, with the token', () => {
    expect(inviteLink('https://film-routes.test', 'abc123')).toBe(
      'https://film-routes.test/invite/abc123',
    );
  });
});

describe('the form', () => {
  it('starts unlimited and with 30 days, ready to send', () => {
    expect(inviteBody(initialInviteForm)).toEqual({
      maxUses: null,
      expiresInDays: 30,
    });
  });

  it('sends the cap and the days that were chosen', () => {
    expect(
      inviteBody({
        uses: 'limited',
        maxUses: '10',
        expiry: 'custom',
        days: '90',
      }),
    ).toEqual({ maxUses: 10, expiresInDays: 90 });
  });

  it('sends null days for "never"', () => {
    expect(
      inviteBody({ ...initialInviteForm, expiry: 'never' })?.expiresInDays,
    ).toBeNull();
  });

  it('ignores a number that is not in use, even if it is wrong', () => {
    const form = { ...initialInviteForm, maxUses: '', days: 'x' };
    expect(inviteFormProblems(form)).toEqual({ maxUses: false, days: false });
    expect(inviteBody(form)).not.toBeNull();
  });

  it('refuses a cap outside 1 to 10 000', () => {
    for (const maxUses of ['', '0', '10001', '1.5', '-3']) {
      const form = { ...initialInviteForm, uses: 'limited' as const, maxUses };
      expect(inviteFormProblems(form).maxUses).toBe(true);
      expect(inviteBody(form)).toBeNull();
    }
    expect(
      inviteBody({
        ...initialInviteForm,
        uses: 'limited',
        maxUses: '10000',
      })?.maxUses,
    ).toBe(10000);
  });

  it('refuses days outside 1 to 365', () => {
    for (const days of ['', '0', '366']) {
      const form = { ...initialInviteForm, expiry: 'custom' as const, days };
      expect(inviteFormProblems(form).days).toBe(true);
      expect(inviteBody(form)).toBeNull();
    }
    expect(
      inviteBody({ ...initialInviteForm, expiry: 'custom', days: '365' })
        ?.expiresInDays,
    ).toBe(365);
  });
});

describe('digitsOnly', () => {
  it('keeps the digits and at most five of them', () => {
    expect(digitsOnly('1a2-3')).toBe('123');
    expect(digitsOnly('1234567')).toBe('12345');
    expect(digitsOnly('')).toBe('');
  });
});

describe('formatDay', () => {
  const now = new Date('2026-11-15T12:00:00Z');

  it('writes the day and month in the language, without the year in this one', () => {
    expect(formatDay('2026-12-12T12:00:00Z', 'es', now)).toMatch(/^12 dic/);
    expect(formatDay('2026-12-12T12:00:00Z', 'en', now)).toMatch(/Dec/);
    expect(formatDay('2026-12-12T12:00:00Z', 'es', now)).not.toMatch(/2026/);
  });

  it('adds the year when it is another one', () => {
    expect(formatDay('2027-01-05T12:00:00Z', 'es', now)).toMatch(/2027/);
  });
});
