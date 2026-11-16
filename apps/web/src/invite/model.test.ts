import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../session/nextPath.js';
import { invitePath, inviteProblem, wayOut } from './model.js';

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
    expect(inviteProblem('invite_revoked')).toBe('revoked');
    expect(inviteProblem('invite_exhausted')).toBe('exhausted');
    expect(inviteProblem('invite_not_found')).toBe('not_found');
  });

  it('says "no longer open" for a private or hidden route', () => {
    expect(inviteProblem('invite_unavailable')).toBe('unavailable');
    expect(inviteProblem('route_hidden')).toBe('unavailable');
  });

  it('knows the author, the removed and the lost connection', () => {
    expect(inviteProblem('cannot_join_own_route')).toBe('own');
    expect(inviteProblem('removed_from_route')).toBe('removed');
    expect(inviteProblem('network_error')).toBe('offline');
    expect(inviteProblem('unauthorized')).toBe('session');
  });

  it('falls back for a code it does not know', () => {
    expect(inviteProblem('something_new')).toBe('unknown');
  });
});

describe('wayOut', () => {
  it('offers a retry only when trying again can help', () => {
    expect(wayOut('offline')).toBe('retry');
    expect(wayOut('unknown')).toBe('retry');
    expect(wayOut('expired')).toBe('explore');
    expect(wayOut('removed')).toBe('explore');
  });

  it('sends the author to their routes and an ended session to sign in', () => {
    expect(wayOut('own')).toBe('myRoutes');
    expect(wayOut('session')).toBe('login');
  });
});
