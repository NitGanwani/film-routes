import { describe, expect, it } from 'vitest';
import {
  applyPatch,
  counterLevel,
  descriptionProblem,
  measure,
  routePatch,
  titleProblem,
} from './model.js';

describe('titleProblem', () => {
  it('asks for a title', () => {
    expect(titleProblem('')).toBe('required');
    expect(titleProblem('   ')).toBe('required');
  });

  it('accepts up to 120 characters, not 121', () => {
    expect(titleProblem('a'.repeat(120))).toBeNull();
    expect(titleProblem('a'.repeat(121))).toBe('tooLong');
  });

  it('does not count the spaces around the text', () => {
    expect(titleProblem(`  ${'a'.repeat(120)}  `)).toBeNull();
  });
});

describe('descriptionProblem', () => {
  it('is optional', () => {
    expect(descriptionProblem('')).toBeNull();
  });

  it('accepts up to 1000 characters, not 1001', () => {
    expect(descriptionProblem('a'.repeat(1000))).toBeNull();
    expect(descriptionProblem('a'.repeat(1001))).toBe('tooLong');
  });
});

describe('counterLevel', () => {
  it('stays hidden until 80 % of the limit', () => {
    expect(counterLevel(0, 120)).toBe('hidden');
    expect(counterLevel(95, 120)).toBe('hidden');
    expect(counterLevel(799, 1000)).toBe('hidden');
  });

  it('appears at 96 of 120 and at 800 of 1000', () => {
    expect(counterLevel(96, 120)).toBe('near');
    expect(counterLevel(800, 1000)).toBe('near');
    expect(counterLevel(119, 120)).toBe('near');
  });

  it('warns at the limit and complains past it', () => {
    expect(counterLevel(120, 120)).toBe('full');
    expect(counterLevel(121, 120)).toBe('over');
  });
});

describe('measure', () => {
  it('counts without the surrounding spaces', () => {
    expect(measure('  hola  ')).toBe(4);
  });
});

describe('routePatch', () => {
  const saved = { title: 'Mi ruta', description: 'Para ti' };

  it('sends nothing when nothing changed', () => {
    expect(
      routePatch(saved, { title: 'Mi ruta', description: 'Para ti' }),
    ).toEqual({});
  });

  it('ignores differences that are only spaces', () => {
    expect(
      routePatch(saved, { title: '  Mi ruta ', description: ' Para ti  ' }),
    ).toEqual({});
  });

  it('sends only the field that changed, trimmed', () => {
    expect(
      routePatch(saved, { title: '  Otra  ', description: 'Para ti' }),
    ).toEqual({ title: 'Otra' });
    expect(
      routePatch(saved, { title: 'Mi ruta', description: 'Nueva' }),
    ).toEqual({ description: 'Nueva' });
  });

  it('clears the description with null when it is emptied', () => {
    expect(routePatch(saved, { title: 'Mi ruta', description: '  ' })).toEqual({
      description: null,
    });
  });

  it('sends nothing for an empty description that was already empty', () => {
    expect(
      routePatch(
        { title: 'Mi ruta', description: null },
        { title: 'Mi ruta', description: '' },
      ),
    ).toEqual({});
  });

  it('holds back an invalid title but still saves the valid description', () => {
    expect(routePatch(saved, { title: '', description: 'Nueva' })).toEqual({
      description: 'Nueva',
    });
    expect(
      routePatch(saved, { title: 'a'.repeat(121), description: 'Para ti' }),
    ).toEqual({});
  });

  it('holds back a description that is too long', () => {
    expect(
      routePatch(saved, { title: 'Otra', description: 'a'.repeat(1001) }),
    ).toEqual({ title: 'Otra' });
  });
});

describe('applyPatch', () => {
  it('changes only what the patch says and keeps the rest', () => {
    const route = { id: 'r', title: 'Mi ruta', description: 'Para ti' };
    expect(applyPatch(route, { title: 'Otra' })).toEqual({
      id: 'r',
      title: 'Otra',
      description: 'Para ti',
    });
    expect(applyPatch(route, { description: null })).toEqual({
      id: 'r',
      title: 'Mi ruta',
      description: null,
    });
  });

  it('does not change the route it is given', () => {
    const route = { title: 'Mi ruta', description: null };
    applyPatch(route, { title: 'Otra' });
    expect(route.title).toBe('Mi ruta');
  });
});
