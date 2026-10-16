import { applyPatches, enablePatches, type Patch } from 'immer';
import type { Deck } from './deck';
import type { Id } from './elements';

enablePatches();

/**
 * One undo and redo stack for the whole deck (EL-8, decision 18). Every edit is a command that comes
 * with the patches that make it and the patches that unmake it; this keeps them in order. Edits of
 * the same kind that follow each other quickly (typing, nudging with the arrow keys) become one step.
 * Pure data and pure functions: nothing here knows about screens.
 */

export interface HistoryEntry {
  /** What the step did, for the button's hint: "Move", "Delete slide". */
  readonly label: string;
  readonly patches: readonly Patch[];
  /** Applying these to the deck after the step gives the deck before it. */
  readonly inverse: readonly Patch[];
  /** The slide to show once the step is undone or redone, if it is still there. */
  readonly slideId: Id | undefined;
  /** The elements to select once the step is undone or redone, those that are still there. */
  readonly ids: readonly Id[];
  /** Steps with the same key, close in time, are merged into one. */
  readonly mergeKey: string | undefined;
  /** When the step (or the last edit merged into it) happened, in milliseconds. */
  readonly at: number;
}

export interface History {
  /** Oldest first: the last one is what Undo undoes. */
  readonly done: readonly HistoryEntry[];
  /** The most recently undone first: what Redo redoes. */
  readonly undone: readonly HistoryEntry[];
}

/** Edits of one kind within this long of each other are one step. */
export const MERGE_WINDOW_MS = 1000;
/** The oldest steps beyond this many are forgotten. */
export const HISTORY_LIMIT = 200;

export const emptyHistory: History = { done: [], undone: [] };

/** Add a step. It clears what could have been redone, and joins the last step if it is the same kind of edit. */
export function record(history: History, entry: HistoryEntry): History {
  const last = history.done.at(-1);
  if (
    last !== undefined &&
    entry.mergeKey !== undefined &&
    last.mergeKey === entry.mergeKey &&
    entry.at - last.at <= MERGE_WINDOW_MS &&
    history.undone.length === 0
  ) {
    const merged: HistoryEntry = {
      ...last,
      patches: [...last.patches, ...entry.patches],
      // Undoing runs the newest edit's inverse first, then the older one's.
      inverse: [...entry.inverse, ...last.inverse],
      ids: entry.ids,
      at: entry.at,
    };
    return { done: [...history.done.slice(0, -1), merged], undone: [] };
  }
  return { done: [...history.done, entry].slice(-HISTORY_LIMIT), undone: [] };
}

export const canUndo = (history: History): boolean => history.done.length > 0;
export const canRedo = (history: History): boolean => history.undone.length > 0;

/** What Undo would undo, or nothing. */
export const undoLabel = (history: History): string | undefined => history.done.at(-1)?.label;
/** What Redo would redo, or nothing. */
export const redoLabel = (history: History): string | undefined => history.undone[0]?.label;

export interface Stepped {
  readonly deck: Deck;
  readonly history: History;
  readonly entry: HistoryEntry;
}

/** Undo the last step: the deck before it, with the step now ready to redo. */
export function undo(history: History, deck: Deck): Stepped | undefined {
  const entry = history.done.at(-1);
  if (entry === undefined) return undefined;
  return {
    deck: applyPatches(deck, [...entry.inverse]),
    history: { done: history.done.slice(0, -1), undone: [entry, ...history.undone] },
    entry,
  };
}

/** Redo the last undone step. */
export function redo(history: History, deck: Deck): Stepped | undefined {
  const entry = history.undone[0];
  if (entry === undefined) return undefined;
  return {
    deck: applyPatches(deck, [...entry.patches]),
    history: { done: [...history.done, entry], undone: history.undone.slice(1) },
    entry,
  };
}
