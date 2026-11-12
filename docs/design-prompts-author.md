# Prompt para Fable: pantallas del autor (guía)

Pegar tal cual en Claude Desktop (Fable). Fable entrega el resultado por fases,
como en el rediseño: cada fase es un prompt que se pega después en Claude Code.

---

```
Estoy construyendo film-routes, una web (React + Vite) donde una persona, la
guía, crea una ruta de 3 a 10 películas para alguien concreto: deja una nota
sin spoilers para antes de verla, otra para después y su propia emoción por
película. Quien la recorre cierra cada película con una emoción obligatoria y
la compara con la de la guía.

YA ESTÁ HECHO (y con tu dirección visual): portada, Explorar, ficha de ruta,
Mis viajes, la vista de viaje con hoja de cierre, login/registro y tutorial.
FALTA toda la parte de la guía, y es lo que te pido ahora.

Dirección visual vigente (no la cambies): sala de cine con las luces
apagadas, un solo tema oscuro, un único acento ámbar, nada de morado; las
imágenes salen de los pósters y backdrops reales de TMDB; grano de película
sutil; Fraunces solo en títulos y Instrument Sans en todo lo demás; movimiento
solo como respuesta a una acción del usuario y siempre respetando
prefers-reduced-motion; las emociones nunca solo con color (icono + etiqueta);
todos los colores salen de tokens.css, ningún hex en componentes.
Componentes que ya existen y debes reutilizar: FilmStrip (tira de película con
perforaciones), EmotionBadge / chips de emoción, RouteCard, Backdrop,
EmptyState, la hoja inferior de cierre (dialog nativo), botones y campos.
Cliente: móvil primero (390 px) y escritorio (1280 px), sin scroll horizontal.

PANTALLAS QUE NECESITO (copy en español, con su versión en inglés al final):

1. Mis rutas (/my-routes). Lista de mis rutas, la más reciente arriba. Cada
   tarjeta: título, idioma, nº de películas, estado de visibilidad
   (privada / solo con enlace / pública), y dos avisos posibles:
   "bloqueada" (ya hay viajeros: las películas no se pueden cambiar) y
   "retirada por moderación" (con el motivo, que la guía puede leer y no puede
   volver a publicarla). Botón "Crear una ruta". Estado vacío para quien no ha
   creado ninguna.

2. Crear / editar ruta (/my-routes/new y /my-routes/:id).
   - Título (máx. 120), descripción opcional (máx. 1000), idioma de escritura
     (es/en; las notas llamarán a las películas con títulos en ese idioma).
   - Buscador de películas (TMDB): escribe y salen resultados con póster, año y
     título. Añadir una película a la ruta.
   - Lista ordenada de las películas elegidas con asas para reordenar (con
     teclado también) y quitar. Contador "3 de 10" con el mínimo (3) y el
     máximo (10) visibles.
   - Por cada película: nota de antes (sin spoilers, máx. 1000), nota de
     después (máx. 1000) y MI emoción (una de las 8, opcional mientras edito).
     Deja clara la diferencia entre "antes" (la ve quien está a punto de
     verla) y "después" (se abre al cerrar la película).
   - Selector de visibilidad: privada / solo con enlace / pública. Para
     compartir hacen falta entre 3 y 10 películas y el correo confirmado:
     muestra esos requisitos y qué falta.
   - Aviso cuando ya hay viajeros: las películas quedan bloqueadas (se pueden
     seguir editando los textos, no la lista ni el orden). Y el aviso previo a
     publicar o invitar: "Una vez que alguien se una, ya no podrás cambiar las
     películas".
   - Guardado: dime si recomiendas guardado automático o botón, y cómo se
     muestran los errores y el "guardado".
   - Borrar la ruta: pide confirmación. Con viajeros dentro NO se puede borrar
     (la API lo rechaza); la salida es volverla privada, y los que ya están
     dentro pueden terminarla. Diséñalo así.

3. Invitaciones (dentro de la ruta). Crear un enlace con tope de usos opcional
   (1 a 10 000, o ilimitado) y caducidad (1 a 365 días, por defecto 30, o sin
   caducidad). Lista de enlaces con estado (activo / caducado / agotado, es
   decir, sin usos libres / revocado), usos, copiar enlace y revocar.

4. Viajeros (dentro de la ruta). Lista de quién ha entrado y cuánto lleva
   (cerradas de total, estado: en curso / completada / abandonada). Poder
   quitar a un viajero (confirmación). Entrando en uno: comparación película
   por película entre mi emoción y la suya, "igual / distinta", y su comentario
   (máx. 280). Reutiliza el lenguaje de la comparación que ya existe en la
   vista de viaje.

5. Lo que cambia en pantallas existentes: la navegación (¿dónde va
   "Mis rutas" junto a Explorar y Mis viajes, en móvil y en escritorio?), el
   botón "Crear una ruta" de la portada para quien ya tiene sesión, y el
   estado vacío de Mis viajes.

CÓMO ENTREGARLO (igual que el rediseño):
- Por fases pequeñas, cada una un prompt autocontenido que yo pegaré en Claude
  Code, ordenadas para que cada fase deje la app funcionando. Propón tú el
  orden; yo sugiero: navegación + Mis rutas, editor (datos básicos), buscador
  y lista de películas con reordenar, notas y emoción, visibilidad y avisos,
  invitaciones, viajeros y comparación.
- Cada fase debe decir: qué componentes reutilizar, qué estados hay (vacío,
  cargando, error, sin permiso, ruta bloqueada, ruta retirada), qué cambia a
  390 px y a 1280 px, el movimiento (solo ante una acción del usuario) y la
  versión con prefers-reduced-motion.
- Reglas que Claude Code debe respetar en cada fase: no tocar la API, colores
  solo de tokens.css, el copy va a los archivos de traducción (es y en con las
  mismas claves), accesibilidad (foco visible, reordenar también con teclado,
  etiquetas, emoción nunca solo con color), sin scroll horizontal a 390 px.
- Si algo del diseño exige un dato que la API no da, dilo en la fase en vez de
  inventarlo.
```

---

## Qué ofrece la API hoy (para decidir qué se puede construir)

- `GET /routes` (mis rutas): id, título, descripción, idioma, visibilidad,
  nº de películas, `locked`, `hidden`, fechas. **Sin pósters ni backdrop** (si
  el diseño quiere portada en Mis rutas, hay que añadirlos a la API).
- `POST /routes`, `GET|PATCH|DELETE /routes/:id` (la ficha del autor incluye
  los pasos con notas, emoción, película y `moderation`).
- `POST /routes/:id/steps` (por `tmdbId`), `PATCH|DELETE .../steps/:stepId`,
  `PUT .../steps/order`.
- `GET /films/search?q=` (TMDB) y `GET /films/:tmdbId`.
- `POST|GET /routes/:id/invites`, `DELETE .../invites/:inviteId`.
- `GET /routes/:id/travelers`, `DELETE .../travelers/:enrollmentId`,
  `GET /routes/:id/travelers/:enrollmentId/journey` (comparación).
- Con viajeros dentro (`locked`): no se puede añadir, quitar ni reordenar
  películas ni borrar la ruta; las notas y la emoción de cada película, el
  título y la descripción sí se siguen editando.
- Límites: 3-10 películas, título 120, descripción y notas 1000, comentario 280.
- Compartir (`visibility` distinta de `private`) exige 3-10 películas y correo
  confirmado.
