import { setLoadingMessage } from './loadingScreen';

export function mountTitleScreen(startGame: () => Promise<unknown>) {
  const title = document.getElementById('title-screen');
  const play = document.getElementById('title-play');
  const loading = document.getElementById('loading-screen');
  if (!title || !(play instanceof HTMLButtonElement) || !loading) {
    throw new Error('Title screen markup is missing');
  }
  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    play.disabled = true;
    title.hidden = true;
    loading.hidden = false;
    loading.removeAttribute('aria-hidden');
    loading.setAttribute('aria-busy', 'true');
    document.body.classList.remove('on-title');
    document.body.classList.add('is-loading');
    setLoadingMessage('Loading the region...');
    await startGame();
  };
  play.addEventListener('click', () => { void start(); });
  play.focus({ preventScroll: true });
}
