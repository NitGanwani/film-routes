import { describe, expect, it } from 'vitest';
import stripSvg from '../../../../docs/design/brand/rating-strip.svg?raw';
import envelopeSvg from '../../../../docs/design/brand/invite-envelope.svg?raw';
import { ENVELOPE_FRAMES, ENVELOPE_HOLES } from '../invite/model.js';
import { STRIP_FRAMES, STRIP_HOLES } from './rating.js';

/**
 * The two drawings are Fable's files (docs/design/brand), redrawn as JSX so
 * the frames can be lit. These tests hold the JSX against the originals: if
 * the design changes the SVG, they say the components have to follow.
 */

/** The x of every <rect> of a drawing that has the given y and (optionally) class. */
function xs(svg: string, y: string, className?: string): number[] {
  const rects = svg.match(/<rect[^>]*>/g) ?? [];
  return rects
    .filter((tag) => new RegExp(`\\sy="${y}"`).test(tag))
    .filter((tag) => !className || tag.includes(`class="${className}"`))
    .map((tag) => Number(/\sx="([\d.]+)"/.exec(tag)?.[1]));
}

describe('rating-strip.svg', () => {
  it('has the perforations where the component draws them', () => {
    expect(xs(stripSvg, '4')).toEqual(STRIP_HOLES);
    expect(xs(stripSvg, '48.5')).toEqual(STRIP_HOLES);
  });

  it('has ten frames, one per point of the scale, where the component draws them', () => {
    expect(xs(stripSvg, '12', 'fr')).toEqual(STRIP_FRAMES);
    expect(stripSvg.match(/data-n="\d+"/g)).toHaveLength(10);
  });

  it('keeps the size the strip is scaled from (340 x 56)', () => {
    expect(stripSvg).toContain('viewBox="0 0 340 56"');
  });
});

describe('invite-envelope.svg', () => {
  it('has the perforations where the component draws them', () => {
    expect(xs(envelopeSvg, '35')).toEqual(ENVELOPE_HOLES);
    expect(xs(envelopeSvg, '77.5')).toEqual(ENVELOPE_HOLES);
  });

  it('has the three frames where the component draws them', () => {
    expect(xs(envelopeSvg, '43', 'fr')).toEqual(ENVELOPE_FRAMES);
  });

  it('keeps the flap as a group that turns over its top edge', () => {
    expect(envelopeSvg).toContain('class="flap"');
    expect(envelopeSvg).toContain('transform-origin:80px 30px');
    expect(envelopeSvg).toContain('viewBox="0 0 160 100"');
  });
});
