// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { failLoading, finishLoading, isLoading, setLoadingMessage } from '../src/ui/loadingScreen';

describe('startup loading cover', () => {
  beforeEach(() => {
    document.body.className = 'is-loading';
    document.body.innerHTML = '<div id="loading-screen" aria-busy="true"><p id="loading-message"></p><button id="loading-retry" hidden>Reload game</button></div>';
  });

  it('keeps the cover active while initialization reports its current stage', () => {
    setLoadingMessage('Building the island...');
    expect(isLoading()).toBe(true);
    expect(document.getElementById('loading-message')?.textContent).toBe('Building the island...');
    expect(document.body.classList.contains('is-loading')).toBe(true);
  });

  it('reveals the game only when explicitly finished after rendering', () => {
    finishLoading();
    finishLoading();
    expect(isLoading()).toBe(false);
    expect(document.getElementById('loading-screen')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.getElementById('loading-screen')?.getAttribute('aria-busy')).toBe('false');
    expect(document.body.classList.contains('is-loading')).toBe(false);
  });

  it('keeps failures visible with a retry instead of revealing an incomplete world', () => {
    failLoading();
    finishLoading();
    expect(isLoading()).toBe(true);
    expect(document.getElementById('loading-screen')?.classList.contains('failed')).toBe(true);
    expect(document.getElementById('loading-message')?.textContent).toContain('could not load');
    expect(document.getElementById('loading-retry')?.hidden).toBe(false);
    expect(document.body.classList.contains('is-loading')).toBe(true);
  });

  it('does not re-open the cover for errors after startup has finished', () => {
    finishLoading();
    failLoading();
    expect(isLoading()).toBe(false);
    expect(document.getElementById('loading-retry')?.hidden).toBe(true);
  });
});
