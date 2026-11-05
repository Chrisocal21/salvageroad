import { failLoading, isLoading } from './ui/loadingScreen';

document.getElementById('loading-retry')?.addEventListener('click', () => location.reload());
window.addEventListener('error', () => { if (isLoading()) failLoading(); });
window.addEventListener('unhandledrejection', () => { if (isLoading()) failLoading(); });

// Paint the static cover before world generation occupies the main thread.
await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
try {
  await import('./main');
} catch (error) {
  console.error('Failed to initialize Salvage Road', error);
  failLoading();
}
