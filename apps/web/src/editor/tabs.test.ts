import { describe, expect, it } from 'vitest';
import {
  tabAfterKey,
  tabFromPath,
  tabPath,
  travelerIdFromPath,
  travelerPath,
} from './tabs.js';

describe('tabPath', () => {
  it('makes the route the base address and the others sub-pages', () => {
    expect(tabPath('abc', 'route')).toBe('/my-routes/abc');
    expect(tabPath('abc', 'invites')).toBe('/my-routes/abc/invites');
    expect(tabPath('abc', 'travelers')).toBe('/my-routes/abc/travelers');
  });
});

describe('tabFromPath', () => {
  it('reads the tab from what follows the id', () => {
    expect(tabFromPath(undefined)).toBe('route');
    expect(tabFromPath('')).toBe('route');
    expect(tabFromPath('invites')).toBe('invites');
    expect(tabFromPath('/travelers/')).toBe('travelers');
  });

  it('does not make up a tab for anything else', () => {
    expect(tabFromPath('settings')).toBeNull();
    expect(tabFromPath('invites/extra')).toBeNull();
  });
});

describe('the page of one traveler', () => {
  it('lives under the Travelers tab', () => {
    expect(travelerPath('abc', 'e1')).toBe('/my-routes/abc/travelers/e1');
    expect(tabFromPath('travelers/e1')).toBe('travelers');
    expect(travelerIdFromPath('/travelers/e1/')).toBe('e1');
  });

  it('is only that exact shape', () => {
    expect(travelerIdFromPath('travelers')).toBeNull();
    expect(travelerIdFromPath('invites/e1')).toBeNull();
    expect(travelerIdFromPath('travelers/e1/more')).toBeNull();
    expect(tabFromPath('invites/e1')).toBeNull();
  });
});

describe('tabAfterKey', () => {
  it('moves with the arrows and wraps around', () => {
    expect(tabAfterKey('route', 'ArrowRight')).toBe('invites');
    expect(tabAfterKey('travelers', 'ArrowRight')).toBe('route');
    expect(tabAfterKey('route', 'ArrowLeft')).toBe('travelers');
    expect(tabAfterKey('invites', 'ArrowLeft')).toBe('route');
  });

  it('jumps with Home and End, and ignores other keys', () => {
    expect(tabAfterKey('invites', 'Home')).toBe('route');
    expect(tabAfterKey('invites', 'End')).toBe('travelers');
    expect(tabAfterKey('invites', 'Enter')).toBeNull();
  });
});
