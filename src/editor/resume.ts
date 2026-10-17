import type { Id } from '@/model';
import type { TabId } from './Inspector';

/**
 * What the editor shows when it is left for a show (PM-1): the slide, what is selected and which tab of
 * the panel is open. Ending the show returns to the editor exactly as it was left, so the editor reads
 * this when it opens. It lives only in memory: reloading the page is a fresh start.
 */
export interface EditorResume {
  readonly deckId: string;
  readonly slideId: Id;
  readonly selection: readonly Id[];
  readonly tab: TabId;
}

let saved: EditorResume | undefined;

/** Remember the editor's state as a show starts. */
export function rememberEditor(state: EditorResume): void {
  saved = state;
}

/** What was remembered for this deck, if anything. Reading it does not use it up (React may read twice). */
export function peekEditor(deckId: string): EditorResume | undefined {
  return saved?.deckId === deckId ? saved : undefined;
}

/** Forget it, once the editor is back and has used it. */
export function clearEditor(): void {
  saved = undefined;
}
