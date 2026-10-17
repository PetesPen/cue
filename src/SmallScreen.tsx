import { useState } from 'react';
import './small-screen.css';

/** The mark of the style guide: a forest square with a yellow dot. */
function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <span className="mark-dot" />
    </span>
  );
}

/**
 * Shown on a phone-sized screen instead of the editor (UX-5; the "Small screen" card of the States board):
 * Cue is for building decks on a computer, and an exported web page plays on any device.
 */
export function SmallScreen() {
  const [copied, setCopied] = useState(false);
  return (
    <main className="small-screen">
      <Mark />
      <h1>Cue is built for larger screens</h1>
      <p>
        Open it on a laptop or desktop to edit. Exported web page decks play on any device,
        including this one.
      </p>
      <button
        type="button"
        className="button button-primary"
        onClick={() => {
          void navigator.clipboard.writeText(window.location.href).then(
            () => {
              setCopied(true);
            },
            () => {
              setCopied(false);
            },
          );
        }}
      >
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </main>
  );
}

/** Shown where Cue cannot run: what is missing, and what does work. */
export function UnsupportedBrowser({ missing }: { readonly missing: readonly string[] }) {
  return (
    <main className="small-screen">
      <Mark />
      <h1>This browser is too old for Cue</h1>
      <p>
        Cue works in the current Chrome, Edge, Firefox and Safari on a computer. This browser has no
        support for:
      </p>
      <ul>
        {missing.map((what) => (
          <li key={what}>{what}</li>
        ))}
      </ul>
    </main>
  );
}
