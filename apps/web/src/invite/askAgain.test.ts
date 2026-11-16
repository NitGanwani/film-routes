import { describe, expect, it, vi } from 'vitest';
import { askForAnother } from './askAgain.js';

const TEXT = 'Hola, ¿me mandas otro?';

describe('askForAnother', () => {
  it('opens the share sheet with the message when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const copy = vi.fn();
    expect(await askForAnother(TEXT, { share, copy })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: TEXT });
    expect(copy).not.toHaveBeenCalled();
  });

  it('copies the message when the browser cannot share', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    expect(await askForAnother(TEXT, { copy })).toBe('copied');
    expect(copy).toHaveBeenCalledWith(TEXT);
  });

  it('does nothing more when the sheet is closed', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('closed', 'AbortError'));
    const copy = vi.fn();
    expect(await askForAnother(TEXT, { share, copy })).toBe('cancelled');
    expect(copy).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when the sheet breaks', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    const copy = vi.fn().mockResolvedValue(undefined);
    expect(await askForAnother(TEXT, { share, copy })).toBe('copied');
  });

  it('says so when nothing worked', async () => {
    const copy = vi.fn().mockRejectedValue(new Error('denied'));
    expect(await askForAnother(TEXT, { copy })).toBe('failed');
  });
});
