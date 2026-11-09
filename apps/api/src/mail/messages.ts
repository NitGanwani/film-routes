import type { Locale } from '@film-routes/shared';
import type { MailMessage } from './mailer.js';

// Working title: change it here when the final name is decided.
const APP_NAME = 'film-routes';

type Text = { subject: string; intro: string; ignore: string };

const verification: Record<Locale, Text> = {
  es: {
    subject: `Confirma tu correo en ${APP_NAME}`,
    intro: 'Abre este enlace para confirmar tu correo (caduca en 24 horas):',
    ignore: 'Si no has creado una cuenta, puedes ignorar este mensaje.',
  },
  en: {
    subject: `Confirm your email on ${APP_NAME}`,
    intro: 'Open this link to confirm your email (it expires in 24 hours):',
    ignore: 'If you did not create an account, you can ignore this message.',
  },
};

const passwordReset: Record<Locale, Text> = {
  es: {
    subject: `Restablece tu contraseña de ${APP_NAME}`,
    intro:
      'Has pedido restablecer tu contraseña. Abre este enlace (caduca en 1 hora):',
    ignore:
      'Si no has sido tú, ignora este mensaje: tu contraseña no cambiará.',
  },
  en: {
    subject: `Reset your ${APP_NAME} password`,
    intro:
      'You asked to reset your password. Open this link (it expires in 1 hour):',
    ignore:
      'If it was not you, ignore this message: your password will not change.',
  },
};

const compose = (to: string, text: Text, link: string): MailMessage => ({
  to,
  subject: text.subject,
  text: `${text.intro}\n\n${link}\n\n${text.ignore}`,
});

export const verificationEmail = (to: string, locale: Locale, link: string) =>
  compose(to, verification[locale], link);

export const passwordResetEmail = (to: string, locale: Locale, link: string) =>
  compose(to, passwordReset[locale], link);
