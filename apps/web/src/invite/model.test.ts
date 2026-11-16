import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../session/nextPath.js';
import {
  invitePath,
  inviteProblem,
  openingTimeline,
  PROBLEM_VIEW,
} from './model.js';

describe('invitePath', () => {
  it('is a path the sign-in page accepts as "next"', () => {
    const path = invitePath('abc_DEF-123');
    expect(path).toBe('/invite/abc_DEF-123');
    expect(safeNextPath(path)).toBe(path);
  });

  it('keeps a strange token inside the path', () => {
    const path = invitePath('a/b?c#d');
    expect(path).toBe('/invite/a%2Fb%3Fc%23d');
    expect(safeNextPath(path)).toBe(path);
  });
});

describe('inviteProblem', () => {
  it('tells each way an invitation can be unusable', () => {
    expect(inviteProblem('invite_expired')).toBe('expired');
    expect(inviteProblem('invite_exhausted')).toBe('exhausted');
    expect(inviteProblem('invite_revoked')).toBe('revoked');
    expect(inviteProblem('route_hidden')).toBe('hidden');
  });

  it('treats a route no longer shared like a link switched off', () => {
    expect(inviteProblem('invite_unavailable')).toBe('revoked');
  });

  it('knows the author, the removed and the lost connection', () => {
    expect(inviteProblem('cannot_join_own_route')).toBe('own');
    expect(inviteProblem('removed_from_route')).toBe('removed');
    expect(inviteProblem('network_error')).toBe('offline');
  });

  it('does not invent a state for what the design does not list', () => {
    for (const code of [
      'invite_not_found',
      'validation_error',
      'route_not_found',
      'unauthorized',
      'internal_error',
      'something_new',
    ]) {
      expect(inviteProblem(code)).toBe('broken');
    }
  });
});

describe('openingTimeline', () => {
  it('shows the new title before it leaves for the route', () => {
    for (const still of [false, true]) {
      const { titleAt, navigateAt } = openingTimeline(still);
      expect(titleAt).toBeLessThan(navigateAt);
    }
  });

  it('takes about 1.6 s, with the 400 ms of the move to the strip', () => {
    expect(openingTimeline(false).navigateAt + 400).toBe(1600);
  });

  it('leaves the steps out when motion is reduced', () => {
    expect(openingTimeline(true)).toEqual({ titleAt: 0, navigateAt: 800 });
  });
});

describe('PROBLEM_VIEW', () => {
  it('speaks as a status only when it is just information', () => {
    const statuses = Object.entries(PROBLEM_VIEW)
      .filter(([, view]) => view.role === 'status')
      .map(([problem]) => problem);
    expect(statuses).toEqual(['own']);
  });

  it('keeps red for dead links and muted for information and connection', () => {
    expect(PROBLEM_VIEW.own.tone).toBe('muted');
    expect(PROBLEM_VIEW.offline.tone).toBe('muted');
    for (const problem of [
      'expired',
      'exhausted',
      'revoked',
      'removed',
      'hidden',
      'broken',
    ] as const) {
      expect(PROBLEM_VIEW[problem].tone).toBe('danger');
    }
  });

  it('asks for another link first only when nobody decided anything', () => {
    expect(PROBLEM_VIEW.expired.primary).toBe('askAgain');
    expect(PROBLEM_VIEW.exhausted.primary).toBe('askAgain');
    for (const problem of ['revoked', 'removed', 'hidden', 'broken'] as const) {
      expect(PROBLEM_VIEW[problem].primary).toBe('explore');
    }
  });

  it('offers to ask again as a second way out where it fits', () => {
    expect(PROBLEM_VIEW.removed.secondary).toBe('askAgain');
    expect(PROBLEM_VIEW.revoked.secondary).toBeUndefined();
    expect(PROBLEM_VIEW.hidden.secondary).toBeUndefined();
  });

  it('retries on its own page and sends the author to the editor', () => {
    expect(PROBLEM_VIEW.offline.primary).toBe('retry');
    expect(PROBLEM_VIEW.own.primary).toBe('editor');
  });

  it('never repeats the same action twice in one state', () => {
    for (const view of Object.values(PROBLEM_VIEW)) {
      expect(view.secondary).not.toBe(view.primary);
    }
  });
});
