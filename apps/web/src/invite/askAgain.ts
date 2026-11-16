/** What happened when the person asked for another link. */
export type AskResult = 'shared' | 'copied' | 'cancelled' | 'failed';

type Env = {
  share?: (data: { text: string }) => Promise<void>;
  copy: (text: string) => Promise<void>;
};

/**
 * "Ask for another link": opens the system's share sheet with a ready-made
 * message. Where there is none (or it breaks), the message goes to the
 * clipboard instead. Closing the sheet is not a failure: nothing else happens.
 */
export async function askForAnother(
  text: string,
  { share, copy }: Env,
): Promise<AskResult> {
  if (share) {
    try {
      await share({ text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      // The sheet could not open: the clipboard is the next best thing.
    }
  }
  try {
    await copy(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** The browser's own share and clipboard, when it has them. */
export function browserEnv(): Env {
  return {
    share:
      typeof navigator.share === 'function'
        ? (data) => navigator.share(data)
        : undefined,
    copy: (text) => navigator.clipboard.writeText(text),
  };
}
