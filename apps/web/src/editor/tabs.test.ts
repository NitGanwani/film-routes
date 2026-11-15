import { describe, expect, it } from 'vitest';
import { tabAfterKey, tabFromPath, tabPath } from './tabs.js';

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
