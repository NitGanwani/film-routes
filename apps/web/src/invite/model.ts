import type { IconName } from '../components/Icon.js';

/** The address of an invitation: what a link made in the editor points at. */
export const invitePath = (token: string) =>
  `/invite/${encodeURIComponent(token)}`;

/**
 * Every way the invitation can fail to open, as the person is told. Never
 * their fault: the problem is the link's, or the route's.
 */
export type InviteProblem =
  | 'expired'
  | 'exhausted'
  | 'revoked'
  | 'own'
  | 'removed'
  | 'hidden'
  | 'offline'
  | 'broken';

/** The variants of the film-strip picture (`InviteEnvelope`). */
export type EnvelopeState =
  'closed' | 'open' | 'off' | 'crossed' | 'lit' | 'lock';

/** What a button of the state does. */
export type InviteAction = 'askAgain' | 'explore' | 'editor' | 'retry';

export type ProblemView = {
  strip: EnvelopeState;
  icon: IconName;
  /** Red for a link that is dead, muted for what is only information. */
  tone: 'danger' | 'muted';
  /** `status` for what is only information, `alert` for what needs reading. */
  role: 'alert' | 'status';
  primary: InviteAction;
  secondary?: InviteAction;
};

/**
 * What the page shows for each problem (Fable, "Estados de error"). Where the
 * person who made the link has decided something (turned it off, removed
 * someone, the route was taken down) the way out is to explore: asking again
 * would only insist.
 */
export const PROBLEM_VIEW: Record<InviteProblem, ProblemView> = {
  expired: {
    strip: 'off',
    icon: 'clock',
    tone: 'danger',
    role: 'alert',
    primary: 'askAgain',
    secondary: 'explore',
  },
  exhausted: {
    strip: 'crossed',
    icon: 'frame-x',
    tone: 'danger',
    role: 'alert',
    primary: 'askAgain',
    secondary: 'explore',
  },
  revoked: {
    strip: 'crossed',
    icon: 'frame-x',
    tone: 'danger',
    role: 'alert',
    primary: 'explore',
  },
  own: {
    strip: 'lit',
    icon: 'frame-lit',
    tone: 'muted',
    role: 'status',
    primary: 'editor',
  },
  removed: {
    strip: 'off',
    icon: 'frame-off',
    tone: 'danger',
    role: 'alert',
    primary: 'explore',
    secondary: 'askAgain',
  },
  hidden: {
    strip: 'lock',
    icon: 'lock',
    tone: 'danger',
    role: 'alert',
    primary: 'explore',
  },
  offline: {
    strip: 'off',
    icon: 'signal',
    tone: 'muted',
    role: 'alert',
    primary: 'retry',
  },
  // A 500, a token that is not even a token: it looks like a dead link and
  // says so. No state of its own.
  broken: {
    strip: 'crossed',
    icon: 'frame-x',
    tone: 'danger',
    role: 'alert',
    primary: 'explore',
  },
};

/** Turns the API's error code into the problem the person is told about. */
export function inviteProblem(code: string): InviteProblem {
  switch (code) {
    case 'invite_expired':
      return 'expired';
    case 'invite_exhausted':
      return 'exhausted';
    // The author stopped sharing the route: for the link it is the same as
    // having switched it off.
    case 'invite_revoked':
    case 'invite_unavailable':
      return 'revoked';
    case 'cannot_join_own_route':
      return 'own';
    case 'removed_from_route':
      return 'removed';
    case 'route_hidden':
      return 'hidden';
    case 'network_error':
      return 'offline';
    default:
      return 'broken';
  }
}

/** How long the opened envelope stays before the route appears (ms). */
export const OPEN_MS = 1400;
/** Without motion there is nothing to wait for: just long enough to read it. */
export const OPEN_MS_STILL = 500;
