import type { Translations } from './es.js';

export const en: Translations = {
  app: { name: 'film-routes' },
  nav: {
    explore: 'Explore',
    login: 'Log in',
    register: 'Sign up',
    logout: 'Log out',
    language: 'Language',
  },
  explore: {
    title: 'Public routes',
    sortNew: 'New',
    sortPopular: 'Popular',
    sortTop: 'Top rated',
    empty: 'There are no public routes yet.',
    films: '{{count}} films',
    completions: '{{count}} completed',
    rating: 'Rating {{average}} ({{votes}} votes)',
    notEnoughVotes: 'Not enough votes yet',
    by: 'by {{author}}',
  },
  auth: {
    email: 'Email',
    username: 'Username',
    password: 'Password',
    loginTitle: 'Log in',
    registerTitle: 'Sign up',
    submitLogin: 'Log in',
    submitRegister: 'Sign up',
    sending: 'Sending…',
  },
  common: {
    loading: 'Loading…',
    retry: 'Try again',
    notFound: 'This page does not exist.',
  },
  errors: {
    unknown: 'Something went wrong. Please try again.',
    network_error: 'Could not reach the server.',
    invalid_credentials: 'Incorrect email or password.',
    account_conflict: 'That username or email is already in use.',
    validation_error: 'Check the form data.',
    too_many_requests: 'Too many attempts. Wait a moment.',
  },
};
