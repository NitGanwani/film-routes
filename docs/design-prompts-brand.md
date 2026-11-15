# Prompts para Fable: identidad de Filmgrim

Pegar en Claude Desktop (Fable), uno detrás de otro. El primero crea el logo;
el segundo diseña los momentos de confirmación (guardado, enlace, ruta
terminada) y necesita el logo ya elegido. Lo que Fable entregue (SVG y una
especificación) se pega después en Claude Code, que lo integra.

---

## Prompt 1 · Logo, wordmark y favicon

```
Necesito la identidad visual de una web que se llama Filmgrim (Film +
Pilgrim: el peregrino del cine). Quiero que explores con libertad, porque no
tengo claro cómo debe ser; me interesa tu criterio.

QUÉ ES
Una persona, la guía, crea una ruta de 3 a 10 películas para alguien
concreto: deja una nota sin spoilers para antes de verla, otra para después y
su propia emoción por película. Quien la recorre (el viajero) las ve en orden,
a su ritmo, y al cerrar cada una compara lo que sintió con lo que sintió la
guía. Es descubrir cine de la mano de alguien, no una base de datos de
películas. Debe sentirse cálida, personal y un poco cinematográfica; nunca
como IMDb ni como una hoja de cálculo. Está en español e inglés.

IDEA DE MARCA
Peregrino = camino con un orden y un sentido, recorrido paso a paso, con
alguien que te guía. El juego "Pilgrim" no lo entiende todo el mundo, así que
el logo no puede depender de él: tiene que funcionar también para quien solo
lee "Filmgrim". Ojo: "grim" significa sombrío en inglés; el tono debe quedar
cálido, no siniestro.

DIRECCIÓN VISUAL VIGENTE (no la cambies, el logo debe vivir dentro de ella)
- Sala de cine cuando se apagan las luces. Un solo tema, oscuro. Un único
  acento cálido ámbar. Nada de morado.
- Colores (los únicos que puedes usar): fondo #0f0e13, superficie #17161d,
  texto crema #f1ece2, crema "luz de proyector" #f1d9a3, ámbar #e3a93a,
  ámbar suave #3a2a10. Las ocho emociones de la app tienen su propio color,
  pero NO deben aparecer en el logo.
- Tipografía: Fraunces (serif de contraste, la usamos en títulos grandes) e
  Instrument Sans para todo lo demás. El wordmark puede partir de Fraunces,
  pero entrégalo convertido a trazados (no dependas de la fuente instalada) y
  retócalo: kerning, ligaduras, la unión Film|grim, lo que haga falta.
- Textura de grano de película muy sutil en fondos, pósters reales de TMDB
  como atmósfera. Cero fotos de stock, cero ilustraciones genéricas.
- El producto ya usa una "tira de película" (una banda oscura con
  perforaciones y un fotograma por película de la ruta; los fotogramas
  cerrados se iluminan). Puedes inspirarte en ella, pero no la copies tal
  cual.

LO QUE QUIERO QUE EXPLORES
Primero propón TRES direcciones realmente distintas (no tres variaciones del
mismo dibujo), cada una con una frase que explique la idea. Después te
pediré elegir y afinar. Evita los clichés (claqueta, carrete, palomitas,
bobina de película genérica, cámara). Piensa en: el camino/sendero hecho de
fotogramas, la ruta ordenada de 3 a 10 pasos, la luz del proyector como
guía, una huella o paso, la letra F o la G como símbolo, un fotograma que se
abre como una puerta. Tiene que ser reconocible a 16 px.

ENTREGABLES (por cada dirección, y luego solo de la elegida)
1. Símbolo (marca sola), cuadrado, sobre fondo oscuro.
2. Wordmark "Filmgrim" (solo texto, a trazados).
3. Lockup horizontal (símbolo + wordmark) para la barra superior: alto de
   32 px, y comprueba que se lee a 24 px.
4. Favicon: versión simplificada del símbolo que funcione a 16, 32 y 48 px
   (pruébalo de verdad a esos tamaños; si el símbolo no aguanta, simplifícalo
   y dime qué quitaste).
5. Icono de app (PWA/iOS): 512 px con "zona segura" para el recorte
   redondeado/enmascarado, y su versión de 180 px.
6. Imagen para compartir en redes (1200×630): fondo oscuro, símbolo,
   wordmark y una frase corta en español ("Una ruta de películas. Para esa
   persona.").
7. Versión de una sola tinta (monocromo) para usar sobre claro o en relieve.

FORMATO (importante, lo integrará otra herramienta)
- Todo en SVG limpio y a mano: sin imágenes incrustadas, sin filtros pesados,
  sin fuentes sin convertir, sin Illustrator metadata. viewBox bien definido.
- En los SVG de interfaz usa `currentColor` para el color principal y
  `var(--accent, #e3a93a)` para el ámbar, para que el logo herede el tema.
  Los de icono/imagen social llevan colores fijos de la paleta de arriba.
- Un único HTML de presentación con todo a la vista: las tres direcciones
  sobre fondo #0f0e13, a tamaños 16, 24, 32, 64, 180 y 512, más una
  maqueta de la barra superior (marca + enlaces Explorar / Mis viajes / Mis
  rutas) a 390 px y a 1280 px de ancho.
- Cada SVG en un bloque de código separado, con el nombre de archivo que debe
  tener (logo-mark.svg, logo-wordmark.svg, logo-lockup.svg, favicon.svg,
  app-icon.svg, og-image.svg, logo-mono.svg).

CRITERIOS
Contraste AA del texto, legible a 16 px, que no dependa del color para
entenderse, que quede bien en oscuro y que se distinga de Letterboxd, Netflix
y Filmin. Dime cuál elegirías tú y por qué en tres líneas.
```

---

## Prompt 2 · Confirmaciones animadas (guardado, edición, enlace, ruta terminada)

Pegar cuando el logo esté elegido, adjuntando `logo-mark.svg` y
`logo-lockup.svg`. Claude Code implementa con **Sonner** (avisos) y **Motion**
(ya instalado, para los dibujos animados), no con Lottie: ver la conversación.

```
Filmgrim es una web (React + Vite) para recorrer rutas de 3 a 10 películas
que alguien hace para otra persona. Adjunto el logo ya elegido. Necesito
diseñar los momentos de confirmación, con animaciones cuidadas y coherentes
con la identidad (el logo, su forma y su ritmo).

DIRECCIÓN VISUAL VIGENTE (no la cambies)
Sala de cine con las luces apagadas. Un solo tema oscuro; un único acento
ámbar; nada de morado. Colores solo de estos tokens: fondo #0f0e13,
superficie #17161d, superficie 2 #201f28, texto #f1ece2, texto apagado
#a69f92, borde #2c2a33, crema de proyector #f1d9a3, ámbar #e3a93a, ámbar suave
#3a2a10, éxito #7ccf94, peligro #f2796b. Fraunces solo en títulos; Instrument
Sans en todo lo demás. Grano de película sutil. Las emociones nunca se
comunican solo con color: icono + etiqueta. Móvil primero (390 px) y
escritorio (1280 px). Existe una barra inferior de navegación en móvil.

LOS MOMENTOS
Ligeros (un aviso que aparece y se va solo):
 1. "Guardado": las notas, el título y la descripción se guardan solos mientras
    escribes. Es el más frecuente: casi invisible, que nunca estorbe ni
    distraiga.
 2. "Cambios guardados" tras una acción explícita (cambiar la visibilidad,
    reordenar, quitar una película, quitar a un viajero).
 3. "Enlace copiado": al copiar el enlace de una ruta o de una invitación.
 4. "Invitación creada": al crear un enlace con tope de usos y caducidad.
Un error nunca usa estos avisos con tono de éxito: dame también el aviso de
error (con icono y texto, role="alert", que no desaparece solo).

Momento grande (una celebración breve, no un diálogo molesto):
 5. "Ruta terminada": un viajero cierra la última película de una ruta.
    Debe sentirse como los créditos finales de una película: es el momento
    emocional del producto. Puede mostrar la tira de película con todos los
    fotogramas iluminados, la comparación de emociones con la guía y la
    invitación a valorar la ruta. Pensado para durar unos 2 segundos de
    animación y quedarse en pantalla hasta que la persona lo cierre.

QUÉ ME TIENES QUE ENTREGAR (por cada momento)
- Diseño visual a 390 y 1280 px: posición en pantalla (en móvil por encima de
  la barra inferior), tamaño, tipografía, colores por token, icono.
- La animación descrita con precisión: qué se mueve, en qué orden, duraciones
  en ms, curvas (cubic-bezier), retardos. Los iconos animados como SVG con
  trazos (se dibujan con pathLength): dame el SVG y los valores de la
  animación, no un GIF ni un Lottie.
- La versión con prefers-reduced-motion: solo fundidos de opacidad, o nada.
- Texto en español e inglés (cortos, sin signos de exclamación en exceso).
- Accesibilidad: cómo lo anuncia un lector de pantalla (aria-live polite para
  los ligeros, assertive solo para errores), cuánto dura en pantalla (mínimo
  5 s para los que llevan texto, y se pausa con foco o hover), y que se pueda
  cerrar con teclado.
- La regla de uso: cuándo sí y cuándo no (por ejemplo, el autoguardado no
  debe lanzar un aviso cada vez, sino cambiar un indicador discreto).

RESTRICCIONES
Sin confeti ni globos: es cine, no una fiesta. Sin sonidos. Sin bibliotecas
de animación externas en el diseño (todo SVG + CSS/Motion). Nada que dependa
solo del color. Entrega un HTML de presentación con cada momento en un
botón "reproducir" sobre un fondo #0f0e13, a 390 y a 1280 px, y cada SVG en
un bloque de código aparte con su nombre de archivo.
```
