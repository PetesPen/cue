import { useSyncExternalStore } from 'react';
import { InfoIcon } from '@/editor/Icons';
import type { Updater } from './pwa';
import './update-banner.css';

/**
 * "A new version of Cue is ready" (UX-7; the banner of the States board): Update now or Later. It only
 * ever appears when a new version is waiting, and nothing changes until Update now is chosen, so a deck
 * being edited is never interrupted. Updating never touches the stored decks.
 */
export function UpdateBanner({ updater }: { readonly updater: Updater }) {
  const state = useSyncExternalStore(updater.subscribe, updater.getState);
  if (state === 'idle') return null;
  return (
    <div className="banner banner-warning update-banner" role="status">
      <span className="banner-icon">
        <InfoIcon size={15} />
      </span>
      <span className="banner-text">
        <strong>A new version of Cue is ready.</strong> Update when it suits you. Your decks stay
        exactly as they are.
      </span>
      <button
        type="button"
        className="button button-compact button-strong"
        disabled={state === 'applying'}
        onClick={() => void updater.apply()}
      >
        {state === 'applying' ? 'Updating…' : 'Update now'}
      </button>
      <button
        type="button"
        className="button button-compact"
        disabled={state === 'applying'}
        onClick={updater.later}
      >
        Later
      </button>
    </div>
  );
}
