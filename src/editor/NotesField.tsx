import { useEffect, useRef, useState } from 'react';
import type { Id } from '@/model';

/** Typing in the notes is saved to the deck after this long without a key, and when you leave it. */
export const NOTES_BURST_MS = 400;

interface NotesFieldProps {
  readonly slideId: Id;
  /** The notes as saved. */
  readonly notes: string;
  /** Save the notes of this slide (a slide id, so a late save never lands on the slide you moved to). */
  readonly onSave: (slideId: Id, notes: string) => void;
  /** Have the pending text saved when the tab is closed or the deck is left. */
  readonly registerFlush: (flush: () => void) => () => void;
}

/**
 * The speaker notes of one slide (SL-6, design: Main): plain text under the canvas. What is typed
 * is saved after a short pause, when focus leaves the field and when the slide changes; each is one
 * command (decision 18). Key this component by slide id, so each slide shows its own notes.
 */
export function NotesField({ slideId, notes, onSave, registerFlush }: NotesFieldProps) {
  const [text, setText] = useState(notes);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef({ text, notes, slideId, onSave });
  useEffect(() => {
    latest.current = { text, notes, slideId, onSave };
  });

  function flush() {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const { text: typed, notes: saved, slideId: id, onSave: save } = latest.current;
    if (typed !== saved) save(id, typed);
  }

  // Leaving the slide (or the deck, or the tab) saves what is pending.
  useEffect(() => {
    const unregister = registerFlush(flush);
    return () => {
      unregister();
      flush();
    };
    // `flush` only reads `latest`, so it is the same function for the life of this field.
  }, [registerFlush]);

  return (
    <textarea
      className="notes-field"
      aria-label="Speaker notes text"
      placeholder="Add notes for this slide"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        // The pending text is read from `latest` when the timer fires, after this render.
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(flush, NOTES_BURST_MS);
      }}
      onBlur={flush}
    />
  );
}
