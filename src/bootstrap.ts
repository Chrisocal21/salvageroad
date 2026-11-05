import { failLoading, isLoading } from './ui/loadingScreen';
import { mountTitleScreen } from './ui/titleScreen';

document.getElementById('loading-retry')?.addEventListener('click', () => location.reload());
window.addEventListener('error', () => { if (isLoading()) failLoading(); });
window.addEventListener('unhandledrejection', () => { if (isLoading()) failLoading(); });

mountTitleScreen(async () => {
  // Paint the loading artwork before world generation occupies the main thread.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  try {
    await import('./main');
  } catch (error) {
    console.error('Failed to initialize Salvage Road', error);
    failLoading();
  }
});
