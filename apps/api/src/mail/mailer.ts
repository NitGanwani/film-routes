export type MailMessage = { to: string; subject: string; text: string };

/**
 * The only thing the rest of the code knows about sending email. A real
 * provider is one more implementation of this, chosen at deploy time.
 */
export type Mailer = { send(message: MailMessage): Promise<void> };

/**
 * Development mailer: prints the message, links included, to the console. It
 * must never run in production, where the logs would then hold working
 * password-reset links.
 */
export function createConsoleMailer(
  log: (text: string) => void = console.log,
): Mailer {
  return {
    async send(message) {
      log(
        `\n--- email to ${message.to} ---\n${message.subject}\n\n${message.text}\n---\n`,
      );
    },
  };
}

/**
 * Starts sending without making the request wait for the provider, so a slow
 * mail server does not slow down (or fail) registration, and the response time
 * does not reveal whether an address has an account. A failure is logged
 * without the message, which holds a live link, and the person can ask again.
 */
export function sendSafely(mailer: Mailer, message: MailMessage) {
  const report = (error: unknown) => {
    console.error('Could not send an email', error);
  };
  try {
    void mailer.send(message).catch(report);
  } catch (error) {
    report(error);
  }
}
