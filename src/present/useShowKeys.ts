import { useEffect } from 'react';
import type { Show } from './show';

/** How long typed digits wait for Enter before they are forgotten. */
const NUMBER_WAIT_MS = 2500;

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
 * The keys of a show, in either window (PM-6): Right, Down, Page Down, Space and Enter go forward; Left,
 * Up, Page Up and Backspace go back; Home and End jump to the first and the last slide; B and W blank
 * the screen; a number then Enter jumps to that slide; Esc ends the show. F, where given, is handled by
 * the window itself. A key with Ctrl, Cmd or Alt is the browser's.
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
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      // A button focused with the keyboard takes Space and Enter itself.
      const onButton = event.target instanceof HTMLButtonElement;
      const key = event.key;
      let handled = true;

      if (/^[0-9]$/.test(key)) {
        typed = (typed + key).slice(0, 4);
        clearTimeout(forget);
        forget = setTimeout(clearTyped, NUMBER_WAIT_MS);
      } else if (key === 'Enter' && typed !== '') {
        show.jump(Number.parseInt(typed, 10) - 1);
        clearTyped();
      } else if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown') show.forward();
      else if ((key === ' ' || key === 'Enter') && !onButton) show.forward();
      else if (
        key === 'ArrowLeft' ||
        key === 'ArrowUp' ||
        key === 'PageUp' ||
        key === 'Backspace'
      ) {
        show.back();
      } else if (key === 'Home') show.toStart();
      else if (key === 'End') show.toEnd();
      else if (key === 'b' || key === 'B') show.blank('black');
      else if (key === 'w' || key === 'W') show.blank('white');
      else if (key === 'Escape') show.end();
      else if ((key === 'f' || key === 'F') && onFullscreen) onFullscreen();
      else handled = false;

      if (handled) event.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(forget);
    };
  }, [show, onFullscreen]);
}
