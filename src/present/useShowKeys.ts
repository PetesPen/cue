import { useEffect } from 'react';
import { NUMBER_WAIT_MS, showActionFor, typeDigit } from '@/model';
import type { Show } from './show';

/**
 * Typing in a field is not a shortcut: the number box of the navigator takes its own keys, and so does the
 * divider (its arrows move it) and the notes when they have focus (their arrows scroll them).
 */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.closest('[role="separator"], .pv-notes-scroll') !== null)
  );
}

/**
 * The keys of a show, in either window (PM-6). What each key means is the table in `model` (`SHOW_KEYS`),
 * which the editor's shortcut sheet reads too; this says what the show does for each action. A number then
 * Enter jumps to that slide. F is the window's own (full screen), so it does nothing where there is no
 * `onFullscreen`.
 */
export function useShowKeys(show: Show, onFullscreen?: () => void): void {
  useEffect(() => {
    let typed = '';
    let forget: ReturnType<typeof setTimeout> | undefined;
    const clearTyped = () => {
      typed = '';
      clearTimeout(forget);
    };

    function onKeyDown(event: KeyboardEvent) {
      const action = showActionFor(event);
      if (!action || isTyping(event.target)) return;
      // A button focused with the keyboard takes Space and Enter itself.
      const onButton = event.target instanceof HTMLButtonElement;
      if (onButton && (event.key === ' ' || event.key === 'Enter')) return;
      if (action === 'fullscreen' && !onFullscreen) return;

      if (action === 'digit') {
        typed = typeDigit(typed, event.key);
        clearTimeout(forget);
        forget = setTimeout(clearTyped, NUMBER_WAIT_MS);
      } else if (action === 'next' && event.key === 'Enter' && typed !== '') {
        show.jump(Number.parseInt(typed, 10) - 1);
        clearTyped();
      } else if (action === 'next') show.forward();
      else if (action === 'previous') show.back();
      else if (action === 'first') show.toStart();
      else if (action === 'last') show.toEnd();
      else if (action === 'blackout') show.blank('black');
      else if (action === 'whiteout') show.blank('white');
      else if (action === 'end') show.end();
      else onFullscreen?.();

      event.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(forget);
    };
  }, [show, onFullscreen]);
}
