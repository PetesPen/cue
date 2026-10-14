import { useId, useRef, useState, type KeyboardEvent } from 'react';

const TABS = [
  { id: 'design', label: 'Design', placeholder: 'Nothing selected.' },
  { id: 'animate', label: 'Animate', placeholder: 'No animations on this slide.' },
  { id: 'transition', label: 'Transition', placeholder: 'No transition on this slide.' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** The right-hand panel: three tabs (Design, Animate, Transition) with empty panels for now. */
export function Inspector() {
  const [active, setActive] = useState<TabId>('design');
  const baseId = useId();
  const tabs = useRef(new Map<TabId, HTMLButtonElement>());

  const tabId = (id: TabId) => `${baseId}-tab-${id}`;
  const panelId = (id: TabId) => `${baseId}-panel-${id}`;

  // Arrow keys, Home and End move between tabs and select them (WAI-ARIA tabs pattern).
  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = TABS.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined;
    const next = target === undefined ? undefined : TABS[target];
    if (!next) return;
    event.preventDefault();
    setActive(next.id);
    tabs.current.get(next.id)?.focus();
  }

  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="tabs" role="tablist" aria-label="Inspector sections">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) tabs.current.set(tab.id, element);
              else tabs.current.delete(tab.id);
            }}
            id={tabId(tab.id)}
            className="tab"
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={panelId(tab.id)}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => {
              setActive(tab.id);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          id={panelId(tab.id)}
          className="tab-panel"
          role="tabpanel"
          aria-labelledby={tabId(tab.id)}
          // WAI-ARIA tabs pattern: a panel with no focusable content must be focusable itself.
          // Remove this once the panels hold controls (the first control then takes focus).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          hidden={active !== tab.id}
        >
          <p className="placeholder">{tab.placeholder}</p>
        </div>
      ))}
    </aside>
  );
}
