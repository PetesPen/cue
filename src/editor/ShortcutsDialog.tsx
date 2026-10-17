import { useId, useState, type RefObject } from 'react';
import { Modal } from './Dialogs';
import { CloseIcon, SearchIcon } from './Icons';
import {
  GROUPS,
  displayKey,
  isMac,
  listed,
  matches,
  type Shortcut,
  type ShortcutGroup,
} from './shortcuts';

/** Two columns, as the board draws them. */
const COLUMNS: readonly (readonly ShortcutGroup[])[] = [
  ['Slides', 'Order', 'General'],
  ['Elements', 'Presenting'],
];

interface ShortcutsDialogProps {
  readonly onClose: () => void;
  /** Focus goes back here when the list closes. */
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}

/**
 * The keyboard shortcut cheat sheet (UX-2; design: Shortcuts). `?` opens it. It lists the shortcuts
 * that work now, narrowed as you type in the search field.
 */
export function ShortcutsDialog({ onClose, returnFocusTo }: ShortcutsDialogProps) {
  const titleId = useId();
  const [query, setQuery] = useState('');
  const mac = isMac();
  const shown = listed().filter((shortcut) => matches(shortcut, query, mac));
  const columns = COLUMNS.map((groups) =>
    GROUPS.filter((group) => groups.includes(group)).map((group) => ({
      group,
      items: shown.filter((shortcut) => shortcut.group === group),
    })),
  ).map((groups) => groups.filter((entry) => entry.items.length > 0));

  return (
    <Modal titleId={titleId} onClose={onClose} returnFocusTo={returnFocusTo} wide>
      <div className="shortcuts-header">
        <h2 id={titleId} className="dialog-title">
          Keyboard shortcuts
        </h2>
        <label className="shortcuts-search">
          <SearchIcon />
          <input
            type="search"
            aria-label="Search shortcuts"
            placeholder="Search shortcuts"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              // A search box clears itself on Escape; here Escape closes the list, whatever is typed.
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
          />
        </label>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="shortcuts-empty">{`No shortcut matches “${query.trim()}”.`}</p>
      ) : (
        // The list scrolls when the window is short, so it takes focus: the keyboard can scroll it (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <div className="shortcuts-body" role="region" aria-label="All shortcuts" tabIndex={0}>
          {columns.map((groups, index) => (
            <div key={index} className="shortcuts-column">
              {groups.map(({ group, items }) => (
                <section key={group} aria-label={group} className="shortcuts-group">
                  <h3 className="section-label">{group}</h3>
                  <ul>
                    {items.map((shortcut) => (
                      <ShortcutRow key={shortcut.id} shortcut={shortcut} mac={mac} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="shortcuts-footer">
        <p className="caption">
          Ctrl on Windows and Linux, ⌘ on Mac. Press ? at any time to open this list.
        </p>
        <button type="button" className="button button-primary button-compact" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function ShortcutRow({ shortcut, mac }: { readonly shortcut: Shortcut; readonly mac: boolean }) {
  return (
    <li className="shortcut-row">
      <span>{shortcut.label}</span>
      <span className="hint-keys">
        {shortcut.keys.map((key) => (
          <kbd key={key} className="keycap">
            {displayKey(key, mac)}
          </kbd>
        ))}
      </span>
    </li>
  );
}
