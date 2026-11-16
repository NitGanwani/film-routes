/** The address of an invitation: what a link made in the editor points at. */
export const invitePath = (token: string) =>
  `/invite/${encodeURIComponent(token)}`;

/** What the page can say when the invitation does not open. */
export type InviteProblem =
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'exhausted'
  | 'unavailable'
  | 'own'
  | 'removed'
  | 'session'
  | 'offline'
  | 'unknown';

/** The way out the page offers for each problem. */
export type InviteWayOut = 'explore' | 'myRoutes' | 'login' | 'retry';

/**
 * Turns the API's error code into what the person is told. The server answers
 * in a different voice for every case (a link that ran out is not a link that
 * was revoked), and so does the page.
 */
export function inviteProblem(code: string): InviteProblem {
  switch (code) {
    case 'invite_not_found':
      return 'not_found';
    case 'invite_expired':
      return 'expired';
    case 'invite_revoked':
      return 'revoked';
    case 'invite_exhausted':
      return 'exhausted';
    // The route is private again, or a moderator hid it: for the person with
    // the link both mean "this is no longer open".
    case 'invite_unavailable':
    case 'route_hidden':
    case 'route_not_found':
      return 'unavailable';
    case 'cannot_join_own_route':
      return 'own';
    case 'removed_from_route':
      return 'removed';
    case 'unauthorized':
      return 'session';
    case 'network_error':
      return 'offline';
    default:
      return 'unknown';
  }
}

export function wayOut(problem: InviteProblem): InviteWayOut {
  switch (problem) {
    case 'own':
      return 'myRoutes';
    case 'session':
      return 'login';
    case 'offline':
    case 'unknown':
      return 'retry';
    default:
      return 'explore';
  }
}

/** How long the opened envelope stays before the route appears (ms). */
export const OPEN_MS = 1400;
/** Without motion there is nothing to wait for: just long enough to read it. */
export const OPEN_MS_STILL = 500;
