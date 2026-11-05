// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRemovalDialog } from '../src/ui/removalDialog';

describe('removal confirmation', () => {
  beforeEach(() => document.body.replaceChildren());
  const buttons = () => [...document.querySelectorAll('button')];

  it('requires explicit confirmation and executes the pending removal only once', () => {
    const dialog = createRemovalDialog(), remove = vi.fn();
    dialog.open('Wood floor', 'Materials are not refunded.', remove);
    expect(document.querySelector('[role=alertdialog]')?.getAttribute('aria-modal')).toBe('true');
    expect(document.body.textContent).toContain('Remove Wood floor?');
    expect(document.activeElement).toBe(buttons()[0]);
    expect(remove).not.toHaveBeenCalled();
    buttons()[1].click();
    buttons()[1].click();
    expect(remove).toHaveBeenCalledOnce();
    expect(dialog.isOpen()).toBe(false);
  });

  it('cancels without removing anything and restores focus', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const dialog = createRemovalDialog(), remove = vi.fn();
    dialog.open('Wood wall', 'No refund.', remove);
    buttons()[1].click();
    expect(remove).not.toHaveBeenCalled();
    expect(dialog.isOpen()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('traps focus, isolates game hotkeys and cancels with Escape', () => {
    const dialog = createRemovalDialog(), remove = vi.fn(), gameKey = vi.fn();
    document.addEventListener('keydown', gameKey);
    try {
      dialog.open('Toolbox bench', 'Returns to inventory.', remove);
      const [cancel, confirm] = buttons();
      cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      expect(document.activeElement).toBe(confirm);
      confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
      expect(document.activeElement).toBe(cancel);
      cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(dialog.isOpen()).toBe(false);
      expect(remove).not.toHaveBeenCalled();
      expect(gameKey).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', gameKey);
    }
  });
});
