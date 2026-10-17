import { registerSW } from 'virtual:pwa-register';
import { Installer, Updater, browserRescue } from './pwa';

// The one updater and the one installer of the app (UX-7). The service worker is registered in production
// builds only, so the development server never serves a stale file.

export const updater = new Updater(registerSW, browserRescue);
export const installer = new Installer(
  window,
  () => window.matchMedia('(display-mode: standalone)').matches,
);

export function startPwa(): void {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) updater.start();
}
