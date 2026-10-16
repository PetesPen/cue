import { useState } from 'react';

interface AltFieldProps {
  /** What the picture is described as now. */
  readonly alt: string;
  readonly onCommit: (alt: string) => void;
}

/**
 * The description of a picture for people who cannot see it (EL-4, UX-6): a few words, saved when you
 * leave the field. Key it by element, so each picture starts from its own words.
 */
export function AltField({ alt, onCommit }: AltFieldProps) {
  const [text, setText] = useState(alt);

  function commit() {
    const next = text.trim();
    setText(next);
    if (next !== alt) onCommit(next);
  }

  return (
    <textarea
      className="alt-field"
      aria-label="Image description"
      placeholder="Describe the picture for people who cannot see it"
      rows={3}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={commit}
    />
  );
}
