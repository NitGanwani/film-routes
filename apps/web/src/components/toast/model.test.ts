import { describe, expect, it } from 'vitest';
import {
  MAX_TOASTS,
  MIN_AFTER_RESUME,
  timeAfterResume,
  withToast,
  withoutToast,
  type Toast,
} from './model.js';

const toast = (id: number, kind: Toast['kind']): Toast => ({
  id,
  kind,
  title: `t${id}`,
  duration: 5000,
});

describe('withToast', () => {
  it('adds a notice at the end', () => {
    expect(withToast([toast(1, 'copied')], toast(2, 'changes'))).toEqual([
      toast(1, 'copied'),
      toast(2, 'changes'),
    ]);
  });

  it('replaces the one of the same kind', () => {
    const next = withToast([toast(1, 'copied')], toast(2, 'copied'));
    expect(next.map((item) => item.id)).toEqual([2]);
  });

  it('never keeps more than the limit, dropping the oldest', () => {
    const full = [toast(1, 'copied'), toast(2, 'changes')];
    const next = withToast(full, toast(3, 'invite'));
    expect(next).toHaveLength(MAX_TOASTS);
    expect(next.map((item) => item.id)).toEqual([2, 3]);
  });
});

describe('withoutToast', () => {
  it('removes one by id and ignores an unknown id', () => {
    const list = [toast(1, 'copied'), toast(2, 'error')];
    expect(withoutToast(list, 1).map((item) => item.id)).toEqual([2]);
    expect(withoutToast(list, 9)).toHaveLength(2);
  });
});

describe('timeAfterResume', () => {
  it('gives at least a second and a half, and keeps a longer rest', () => {
    expect(timeAfterResume(300)).toBe(MIN_AFTER_RESUME);
    expect(timeAfterResume(4000)).toBe(4000);
  });
});
