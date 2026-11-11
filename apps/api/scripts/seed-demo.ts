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
type DemoRoute = {
  title: string;
  description: string;
  /** The language the route is written in; Spanish when not given. */
  locale?: 'es' | 'en';
  films: Film[];
};

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
  {
    title: 'Comedias para reír sin culpa',
    description:
      'Cuatro películas para cuando solo quieres pasarlo bien. Se ven mejor en compañía.',
    films: [
      {
        tmdbId: 137,
        noteBefore:
          'Una idea muy simple que da mucho más de sí de lo que parece. Aguanta los primeros minutos.',
        noteAfter:
          'Empieza como un chiste y acaba hablando de quién quieres ser. No me lo esperaba.',
        authorEmotion: 'joy',
      },
      {
        tmdbId: 773,
        noteBefore:
          'Una familia, una furgoneta y un viaje que sale mal. Ponla con gente que quieras.',
        noteAfter:
          'Me reí en voz alta y a los diez minutos tenía un nudo en la garganta. Esa mezcla es lo mejor.',
        authorEmotion: 'tenderness',
      },
      {
        tmdbId: 120467,
        noteBefore:
          'Cada plano parece un cuadro. Fíjate en los colores y en lo rápido que hablan.',
        noteAfter:
          'Detrás del humor hay una nostalgia enorme por un mundo que ya no existe.',
        authorEmotion: 'joy',
      },
      {
        tmdbId: 346648,
        noteBefore:
          'No te dejes engañar por el osito: es una película para todas las edades.',
        noteAfter:
          'Una película amable de verdad, sin ironía por debajo. Salí con ganas de ser mejor persona.',
        authorEmotion: 'tenderness',
      },
    ],
  },
  {
    title: 'Para llorar a gusto',
    description:
      'Pañuelos a mano. Cuatro películas que duelen un poco y que luego se agradecen.',
    films: [
      {
        tmdbId: 11216,
        noteBefore:
          'Una carta de amor al cine, con un niño y un proyeccionista. Mejor con calma.',
        noteAfter:
          'La última escena es de las que se te quedan para siempre. Prepárate.',
        authorEmotion: 'sadness',
      },
      {
        tmdbId: 14160,
        noteBefore:
          'Los primeros diez minutos son lo que más se recuerda. Dales tiempo y no mires nada antes.',
        noteAfter:
          'Dice más de la vida corriente en un montaje mudo que muchas películas enteras.',
        authorEmotion: 'sadness',
      },
      {
        tmdbId: 637,
        noteBefore:
          'Empieza con humor y acaba en otro sitio. Ten paciencia con la primera mitad.',
        noteAfter:
          'Cuando entiendes para qué eran los juegos, ya no puedes parar de llorar.',
        authorEmotion: 'tenderness',
      },
      {
        tmdbId: 38,
        noteBefore:
          'Una historia de amor contada al revés y con una idea muy rara. Atento a los detalles.',
        noteAfter:
          'Me hizo pensar en qué recuerdos elegiría borrar. Y en cuáles no lo haría nunca.',
        authorEmotion: 'thoughtful',
      },
    ],
  },
  {
    title: 'Thrillers que no te sueltan',
    description:
      'Cuatro películas con el pulso alto de principio a fin. Mejor sin interrupciones.',
    films: [
      {
        tmdbId: 77,
        noteBefore:
          'Hay que prestar atención: la historia no va en orden. Ponla cuando estés despejado.',
        noteAfter:
          'Al terminar me dieron ganas de verla otra vez de golpe, ya sabiendo cómo va.',
        authorEmotion: 'thoughtful',
      },
      {
        tmdbId: 210577,
        noteBefore:
          'Una desaparición y un matrimonio. Cuanto menos sepas de antemano, mejor.',
        noteAfter:
          'Lo inquietante no es el misterio, sino darte cuenta de a quién estabas creyendo.',
        authorEmotion: 'discomfort',
      },
      {
        tmdbId: 496243,
        noteBefore:
          'Empieza como una comedia y cambia de piel varias veces. No leas nada sobre ella.',
        noteAfter:
          'Esa mezcla de risa y angustia es lo que la hace tan incómoda y tan buena.',
        authorEmotion: 'tension',
      },
      {
        tmdbId: 146233,
        noteBefore:
          'Es dura y es larga. No la veas si hoy necesitas algo ligero.',
        noteAfter:
          'La última escena te deja en suspenso a propósito. Aún pienso en ella.',
        authorEmotion: 'fear',
      },
    ],
  },
  {
    title: 'Fantasía para volver a asombrarse',
    description:
      'Mundos inventados que hablan de cosas muy reales. Cuatro películas para mirar con ojos de niño.',
    films: [
      {
        tmdbId: 1417,
        noteBefore:
          'Un cuento oscuro, no un cuento para niños. Mejor ver ya de noche.',
        noteAfter:
          'Me quedé con la duda de qué era real y qué se inventaba ella, y creo que da igual.',
        authorEmotion: 'awe',
      },
      {
        tmdbId: 2493,
        noteBefore:
          'Una historia dentro de otra historia, contada con mucho humor. Ríete sin miedo.',
        noteAfter:
          'Es a la vez una aventura de verdad y una burla de las aventuras. Lo logra sin esfuerzo.',
        authorEmotion: 'joy',
      },
      {
        tmdbId: 587,
        noteBefore:
          'Un padre que cuenta historias imposibles y un hijo que quiere saber cuáles son ciertas.',
        noteAfter:
          'Entendí por qué contamos cuentos: para que alguien nos recuerde como queremos ser recordados.',
        authorEmotion: 'tenderness',
      },
      {
        tmdbId: 87827,
        noteBefore:
          'Visualmente es una fiesta. Mira la pantalla más grande que tengas.',
        noteAfter:
          'Me dejó pensando en qué versión de una historia prefiero creer. Y por qué.',
        authorEmotion: 'awe',
      },
    ],
  },
  {
    title: 'Eighties afternoons',
    description:
      'Four films that feel like a Sunday afternoon in the eighties: friends, bikes and the odd bad decision.',
    locale: 'en',
    films: [
      {
        tmdbId: 105,
        noteBefore:
          'Pure fun, and surprisingly well put together. Pay attention to the small things early on.',
        noteAfter:
          'Everything that is set up in the first twenty minutes pays off. Nothing is wasted.',
        authorEmotion: 'joy',
      },
      {
        tmdbId: 2108,
        noteBefore:
          'Five teenagers, one room, one Saturday. It is mostly people talking.',
        noteAfter:
          'It is about how little we let each other see. I did not expect that to hit me.',
        authorEmotion: 'tenderness',
      },
      {
        tmdbId: 9377,
        noteBefore: 'Light, quick and a bit cheeky. Do not overthink it.',
        noteAfter:
          'Behind the jokes it is really about a friend who is afraid of growing up.',
        authorEmotion: 'joy',
      },
      {
        tmdbId: 235,
        noteBefore:
          'A walk along some railway tracks. Quiet, and better if you have time afterwards.',
        noteAfter:
          'The last line stays with you: friends like those do not come back.',
        authorEmotion: 'sadness',
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
      body: {
        title: demo.title,
        description: demo.description,
        locale: demo.locale ?? 'es',
      },
    });
    if (created.status !== 201) {
      throw new Error(`No se pudo crear "${demo.title}" (${created.status})`);
    }
    const routeId = created.json.route.id;
    try {
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
    } catch (error) {
      // A half-built route would be skipped next time (it has the same title):
      // remove it so running the script again starts it from scratch.
      await call(`/routes/${routeId}`, { method: 'DELETE', token });
      throw error;
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
