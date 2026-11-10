/**
 * Sample data for trying the web by hand: one guide with a known password and a
 * few public routes. It talks to the running API (so every rule is checked as
 * usual) and only skips the email step by marking the account as confirmed.
 *
 *   npm run seed:demo -w @film-routes/api
 *
 * Safe to run again: routes that already exist are left alone.
 * Development only: the password below is public.
 */
import { loadConfig } from '../src/config.js';
import { createPrismaClient } from '../src/db.js';

const config = loadConfig();
if (config.NODE_ENV === 'production') {
  throw new Error('seed:demo is for development only');
}

const API = process.env.API_URL ?? `http://localhost:${config.PORT}`;
const GUIDE = {
  username: 'demo_guia',
  email: 'demo.guia@example.test',
  password: 'demo-password-123',
};

type Emotion =
  | 'joy'
  | 'tenderness'
  | 'awe'
  | 'thoughtful'
  | 'tension'
  | 'fear'
  | 'sadness'
  | 'discomfort';
type Film = {
  tmdbId: number;
  noteBefore: string;
  noteAfter: string;
  authorEmotion: Emotion;
};
type DemoRoute = { title: string; description: string; films: Film[] };

// Notes before hold no spoilers; notes after may talk about the ending.
const ROUTES: DemoRoute[] = [
  {
    title: 'Terror clásico para una noche',
    description:
      'Cuatro películas que enseñaron al cine a asustar sin enseñar casi nada. Mejor con las luces apagadas.',
    films: [
      {
        tmdbId: 539,
        noteBefore:
          'Dura casi dos horas y la música hace la mitad del trabajo. No mires el móvil.',
        noteAfter:
          'La ducha no es lo más inquietante: es lo tranquilo que queda todo justo después.',
        authorEmotion: 'tension',
      },
      {
        tmdbId: 694,
        noteBefore:
          'Fíjate en los pasillos y en cómo se mueve la cámara. Dale tiempo, es lenta a propósito.',
        noteAfter:
          'Lo que de verdad da miedo es la rutina que se va torciendo, no los fantasmas.',
        authorEmotion: 'discomfort',
      },
      {
        tmdbId: 9552,
        noteBefore:
          'Tarda en arrancar. Aguanta la primera hora: está construyendo algo.',
        noteAfter:
          'Lo peor no es lo sobrenatural, es ver a una madre sin poder hacer nada.',
        authorEmotion: 'fear',
      },
      {
        tmdbId: 348,
        noteBefore:
          'Ciencia ficción con alma de casa encantada. Cuanto menos sepas, mejor.',
        noteAfter:
          'Un monstruo que casi no se ve y aun así no puedes respirar. Perfecto para cerrar la noche.',
        authorEmotion: 'tension',
      },
    ],
  },
  {
    title: 'Ghibli para días grises',
    description:
      'Para cuando necesitas que alguien te cuide un rato. Cuatro películas que consuelan sin ser tontas.',
    films: [
      {
        tmdbId: 8392,
        noteBefore:
          'La más pequeña y la más tierna. No esperes una trama grande.',
        noteAfter:
          'Me di cuenta de que lo mejor eran los ratos en los que no pasaba nada.',
        authorEmotion: 'tenderness',
      },
      {
        tmdbId: 129,
        noteBefore:
          'Déjate llevar aunque no entiendas todo a la primera. Va de crecer.',
        noteAfter:
          'La escena del tren: silencio, agua y nada más. Se queda contigo días.',
        authorEmotion: 'awe',
      },
      {
        tmdbId: 4935,
        noteBefore:
          'Una historia de amor rara, con un castillo que camina. Ponle sueño del bueno.',
        noteAfter:
          'Habla de hacerse mayor y de que no pasa nada por ello. Qué bien suena.',
        authorEmotion: 'joy',
      },
      {
        tmdbId: 128,
        noteBefore:
          'La más seria de las cuatro. Aquí nadie es del todo bueno ni del todo malo.',
        noteAfter:
          'Me dejó pensando en quién tiene razón. Y no encontré respuesta.',
        authorEmotion: 'thoughtful',
      },
    ],
  },
  {
    title: 'Ciencia ficción que hace pensar',
    description:
      'Tres películas para ver con tiempo y hablar después. Ninguna tiene prisa.',
    films: [
      {
        tmdbId: 78,
        noteBefore:
          'Es más una película de ambiente que de acción. Deja que la ciudad te envuelva.',
        noteAfter:
          'El discurso final dura medio minuto y vale por toda la película.',
        authorEmotion: 'sadness',
      },
      {
        tmdbId: 329865,
        noteBefore:
          'Empieza lenta y poco a poco lo entiendes todo. No busques el móvil, sigue a la protagonista.',
        noteAfter:
          'El final cambia lo que habías visto. Me quedé un rato en silencio.',
        authorEmotion: 'thoughtful',
      },
      {
        tmdbId: 157336,
        noteBefore:
          'Larga y con mucha física, pero lo importante es la relación entre padre e hija.',
        noteAfter:
          'La escena de los mensajes acumulados me hizo llorar. No me lo esperaba.',
        authorEmotion: 'awe',
      },
    ],
  },
];

async function call<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; json: T }> {
  const response = await fetch(`${API}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    json: (text ? JSON.parse(text) : null) as T,
  };
}

type Tokens = { tokens: { accessToken: string } };

async function signIn(): Promise<string> {
  const registered = await call<Tokens>('/auth/register', {
    method: 'POST',
    body: { ...GUIDE, locale: 'es' },
  });
  if (registered.status === 201 || registered.status === 200) {
    console.log(`Cuenta ${GUIDE.username} creada.`);
    return registered.json.tokens.accessToken;
  }
  if (registered.status !== 409) {
    throw new Error(`No se pudo crear la cuenta (${registered.status})`);
  }
  const login = await call<Tokens>('/auth/login', {
    method: 'POST',
    body: { email: GUIDE.email, password: GUIDE.password },
  });
  if (login.status !== 200) {
    throw new Error(
      'La cuenta demo ya existe pero la contraseña no coincide: bórrala y repite',
    );
  }
  console.log(`Cuenta ${GUIDE.username} ya existía.`);
  return login.json.tokens.accessToken;
}

async function main() {
  // The API only lets confirmed accounts share routes; confirm this one directly.
  await signIn();
  const db = createPrismaClient(config.DATABASE_URL);
  try {
    await db.user.updateMany({
      where: { email: GUIDE.email, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  } finally {
    await db.$disconnect();
  }
  // Sign in again now that the account is confirmed.
  const token = await signIn();

  const existing = await call<{ routes: { title: string }[] }>('/routes', {
    token,
  });
  const titles = new Set(existing.json.routes.map((route) => route.title));

  for (const demo of ROUTES) {
    if (titles.has(demo.title)) {
      console.log(`Ya existe: ${demo.title}`);
      continue;
    }
    const created = await call<{ route: { id: string } }>('/routes', {
      method: 'POST',
      token,
      body: { title: demo.title, description: demo.description, locale: 'es' },
    });
    if (created.status !== 201) {
      throw new Error(`No se pudo crear "${demo.title}" (${created.status})`);
    }
    const routeId = created.json.route.id;
    for (const film of demo.films) {
      const step = await call(`/routes/${routeId}/steps`, {
        method: 'POST',
        token,
        body: film,
      });
      if (step.status !== 201 && step.status !== 200) {
        throw new Error(
          `No se pudo añadir la película ${film.tmdbId} a "${demo.title}" (${step.status}): ${JSON.stringify(step.json)}`,
        );
      }
    }
    const published = await call(`/routes/${routeId}`, {
      method: 'PATCH',
      token,
      body: { visibility: 'public' },
    });
    if (published.status !== 200) {
      throw new Error(
        `No se pudo publicar "${demo.title}" (${published.status})`,
      );
    }
    console.log(`Creada y publicada: ${demo.title}`);
  }

  console.log('\nListo. Entra en la web con la cuenta de la guía:');
  console.log(`  correo:     ${GUIDE.email}`);
  console.log(`  contraseña: ${GUIDE.password}`);
  console.log('Y registra otra cuenta para recorrer sus rutas como viajero.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
