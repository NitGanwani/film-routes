import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { publicRouteQuery, publicRoutesQuery } from '../api/queries.js';
import { Icon, type IconName } from '../components/Icon.js';
import { PublicRouteCard } from '../components/PublicRouteCard.js';
import { backdropSources } from '../films/images.js';
import {
  exampleRoute,
  featuredRoutes,
  mosaicRows,
  stripPosters,
} from '../landing/model.js';
import { gsap } from '../motion/gsap.js';
import { prefersReducedMotion } from '../motion/reducedMotion.js';

/** The four steps of "how it works": each with one icon of the sprite. */
const STEPS = [
  { id: 'choose', icon: 'film' },
  { id: 'notes', icon: 'eye-off' },
  { id: 'send', icon: 'link' },
  { id: 'discover', icon: 'tenderness' },
] as const satisfies readonly { id: string; icon: IconName }[];

/** What the browser needs to pick a backdrop width: a tile is 30 % of the screen, 240 px at least. */
const TILE_SIZES = '(min-width: 800px) 30vw, 240px';

/**
 * The front door, for visitors who are not signed in: a hero over a slow
 * mosaic of real backdrops, how it works, an example route, a few routes to
 * start with and a closing invitation. It is the one page that animates as you
 * scroll (GSAP, loaded only here), and not at all if the person asks for less
 * motion. Every picture comes from the public routes, that is, from TMDB.
 */
export function LandingPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'es';

  // The popular order lists every route (the mosaic and the cards come from it).
  // "Top" only lists routes with enough votes, so it can be empty: the example
  // is the best rated route when there is one, and a popular one otherwise.
  const popular = useQuery(publicRoutesQuery('popular', null));
  const top = useQuery(publicRoutesQuery('top', null));
  const list = popular.data?.routes ?? [];
  const example = exampleRoute(
    [...(top.data?.routes ?? []), ...list],
    language,
  );
  const featured = featuredRoutes(list, language);
  const [rowA, rowB] = mosaicRows(list.map((route) => route.coverUrl));

  const detail = useQuery({
    ...publicRouteQuery(example?.id ?? ''),
    enabled: example !== null,
  });
  const strip = stripPosters(
    detail.data?.steps.map((step) => step.film.posterUrl) ?? [],
  );

  const stepsRef = useRef<HTMLOListElement>(null);
  const stripRef = useRef<HTMLUListElement>(null);

  // The four steps come in one after another, once, as they reach the screen.
  useEffect(() => {
    const steps = stepsRef.current;
    if (!steps || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.from(steps.children, {
        y: 24,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.12,
        scrollTrigger: { trigger: steps, start: 'top 80%', once: true },
      });
    });
    return () => context.revert();
  }, []);

  // The poster strip slides sideways, softly, while the section crosses the screen.
  const hasStrip = strip.length > 0;
  useEffect(() => {
    const posters = stripRef.current;
    if (!hasStrip || !posters || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        posters,
        { xPercent: 0 },
        {
          xPercent: -30,
          ease: 'none',
          scrollTrigger: {
            trigger: posters.parentElement,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        },
      );
    });
    return () => context.revert();
  }, [hasStrip]);

  return (
    <>
      <section className="landing-hero">
        {rowA.length > 0 && (
          <div className="mosaic" aria-hidden="true">
            <MosaicRow urls={rowA} />
            <MosaicRow urls={rowB} reverse />
          </div>
        )}
        <div className="landing-hero-copy">
          <h1>{t('landing.heroTitle')}</h1>
          <p>{t('landing.heroText')}</p>
          <div className="landing-actions">
            <Link className="btn btn-primary" to="/register">
              {t('landing.create')}
            </Link>
            {example && (
              <Link className="btn btn-secondary" to={`/routes/${example.id}`}>
                {t('landing.example')}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-how">
        <h2 id="landing-how">{t('landing.howTitle')}</h2>
        <ol className="landing-steps" ref={stepsRef}>
          {STEPS.map(({ id, icon }) => (
            <li key={id} className="landing-step">
              <span className="landing-step-icon">
                <Icon name={icon} size={26} />
              </span>
              <h3>{t(`landing.steps.${id}.title`)}</h3>
              <p>{t(`landing.steps.${id}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {example && hasStrip && (
        <section
          className="landing-strip-section"
          aria-labelledby="landing-example"
        >
          <div className="landing-section landing-strip-head">
            <h2 id="landing-example">{t('landing.exampleTitle')}</h2>
            <p>
              {t('landing.exampleBy', {
                title: example.title,
                author: example.author,
              })}{' '}
              <Link to={`/routes/${example.id}`}>
                {t('landing.exampleOpen')}
              </Link>
            </p>
          </div>
          <div className="landing-strip-clip">
            <ul className="landing-strip" ref={stripRef} aria-hidden="true">
              {strip.map((url, index) => (
                <li key={index}>
                  <img src={url} alt="" loading="lazy" decoding="async" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="landing-section" aria-labelledby="landing-featured">
          <div className="landing-head">
            <h2 id="landing-featured">{t('landing.featuredTitle')}</h2>
            <Link to="/explore">{t('landing.featuredAll')}</Link>
          </div>
          <ul className="route-list grid">
            {featured.map((route) => (
              <PublicRouteCard key={route.id} route={route} />
            ))}
          </ul>
        </section>
      )}

      <section className="landing-closing">
        <blockquote>
          <p>{t('landing.quote')}</p>
        </blockquote>
        <Link className="btn btn-primary" to="/register">
          {t('landing.start')}
        </Link>
      </section>
    </>
  );
}

/**
 * A row of backdrops that drifts sideways. The pictures are written twice and
 * the row moves by exactly half of its width, so the loop has no seam.
 */
function MosaicRow({
  urls,
  reverse = false,
}: {
  urls: string[];
  reverse?: boolean;
}) {
  return (
    <div className="mosaic-row" data-reverse={reverse}>
      <div className="mosaic-track">
        {[0, 1].map((copy) => (
          <div className="mosaic-set" key={copy}>
            {urls.map((url, index) => {
              const sources = backdropSources(url);
              return (
                <img
                  key={index}
                  src={sources.src}
                  srcSet={sources.srcSet}
                  sizes={TILE_SIZES}
                  alt=""
                  decoding="async"
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
