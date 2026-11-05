export function isLoading() {
  const screen = document.getElementById('loading-screen');
  return screen !== null && !screen.hidden && !screen.classList.contains('is-ready');
}

export function setLoadingMessage(message: string) {
  const label = document.getElementById('loading-message');
  if (label) label.textContent = message;
}

export function finishLoading() {
  const screen = document.getElementById('loading-screen');
  if (!screen || screen.classList.contains('failed')) return;
  screen.classList.add('is-ready');
  screen.setAttribute('aria-busy', 'false');
  screen.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-loading');
}

export function failLoading() {
  const screen = document.getElementById('loading-screen');
  if (!screen || !isLoading()) return;
  screen.classList.add('failed');
  screen.setAttribute('aria-busy', 'false');
  setLoadingMessage('The world could not load. Reload the game to try again.');
  const retry = document.getElementById('loading-retry');
  if (retry) retry.hidden = false;
}
