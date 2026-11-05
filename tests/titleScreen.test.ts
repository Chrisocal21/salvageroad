// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountTitleScreen } from '../src/ui/titleScreen';
import { isLoading } from '../src/ui/loadingScreen';

describe('title screen startup', () => {
  beforeEach(() => {
    document.body.className = 'on-title';
    document.body.innerHTML = '<main id="title-screen"><button id="title-play">Play</button></main><div id="loading-screen" hidden aria-hidden="true"><p id="loading-message"></p></div>';
  });

  it('does not initialize the world until Play is activated', () => {
    const start = vi.fn(async () => {});
    mountTitleScreen(start);
    expect(start).not.toHaveBeenCalled();
    expect(isLoading()).toBe(false);
    expect(document.activeElement?.id).toBe('title-play');
    expect(document.getElementById('title-screen')?.hidden).toBe(false);
  });

  it('shows loading and starts the world only once', () => {
    const start = vi.fn(async () => {});
    mountTitleScreen(start);
    const play = document.getElementById('title-play') as HTMLButtonElement;
    play.click();
    play.click();
    expect(start).toHaveBeenCalledOnce();
    expect(play.disabled).toBe(true);
    expect(document.getElementById('title-screen')?.hidden).toBe(true);
    expect(isLoading()).toBe(true);
    expect(document.getElementById('loading-screen')?.getAttribute('aria-hidden')).toBeNull();
    expect(document.getElementById('loading-screen')?.getAttribute('aria-busy')).toBe('true');
    expect(document.body.className).toBe('is-loading');
    expect(document.getElementById('loading-message')?.textContent).toBe('Loading the region...');
  });

  it('reports missing markup rather than silently skipping the title screen', () => {
    document.getElementById('title-play')?.remove();
    expect(() => mountTitleScreen(vi.fn())).toThrow('Title screen markup is missing');
  });
});
