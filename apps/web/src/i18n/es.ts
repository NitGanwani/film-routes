/** Spanish is the source of truth: English must have exactly the same keys. */
export const es = {
  app: { name: 'film-routes' },
  nav: {
    explore: 'Explorar',
    login: 'Entrar',
    register: 'Crear cuenta',
    logout: 'Salir',
    language: 'Idioma',
  },
  explore: {
    title: 'Rutas públicas',
    sortNew: 'Nuevas',
    sortPopular: 'Populares',
    sortTop: 'Mejor valoradas',
    empty: 'Todavía no hay rutas públicas.',
    films: '{{count}} películas',
    completions: '{{count}} completadas',
    rating: 'Nota {{average}} ({{votes}} votos)',
    notEnoughVotes: 'Pocas valoraciones todavía',
    by: 'por {{author}}',
  },
  auth: {
    email: 'Correo',
    username: 'Nombre de usuario',
    password: 'Contraseña',
    loginTitle: 'Entrar',
    registerTitle: 'Crear cuenta',
    submitLogin: 'Entrar',
    submitRegister: 'Crear cuenta',
    sending: 'Enviando…',
  },
  common: {
    loading: 'Cargando…',
    retry: 'Reintentar',
    notFound: 'Esta página no existe.',
  },
  errors: {
    unknown: 'Algo ha salido mal. Inténtalo de nuevo.',
    network_error: 'No se pudo conectar con el servidor.',
    invalid_credentials: 'Correo o contraseña incorrectos.',
    account_conflict: 'Ese usuario o correo ya está en uso.',
    validation_error: 'Revisa los datos del formulario.',
    too_many_requests: 'Demasiados intentos. Espera un poco.',
  },
} as const;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type Translations = Widen<typeof es>;
