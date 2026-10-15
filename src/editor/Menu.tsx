import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { DotsIcon } from './Icons';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly danger?: boolean;
  /** Greyed out and skipped by the arrow keys (for example Bring to Front on the top element). */
  readonly disabled?: boolean;
  /** Shown at the right, for example "Ctrl+]". Announced through `aria-keyshortcuts`, not read twice. */
  readonly shortcut?: string;
  readonly keyShortcuts?: string;
  /** A divider above this item. */
  readonly separated?: boolean;
}

interface MenuPanelProps {
  readonly label: string;
  readonly items: readonly MenuItem[];
  /** Called with whether focus should return to where the menu came from. */
  readonly onClose: (restoreFocus: boolean) => void;
  /** A click here does not count as "outside" (the button that opened the menu). */
  readonly ignore?: RefObject<HTMLElement | null>;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * The list itself (design: Home, deck options). Opens with the first enabled item focused; Up,
 * Down, Home and End move, Escape closes and asks for focus back, and so does clicking elsewhere.
 */
function MenuPanel({ label, items, onClose, ignore, className = 'menu', style }: MenuPanelProps) {
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menu.current?.contains(target) || ignore?.current?.contains(target)) return;
      onClose(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [ignore, onClose]);

  function onKeyDown(event: KeyboardEvent) {
    const entries = [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []),
    ];
    const at = entries.findIndex((entry) => entry === document.activeElement);
    const move = (to: number) => {
      event.preventDefault();
      entries[(to + entries.length) % entries.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(entries.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
    } else if (event.key === 'Tab') onClose(false);
  }

  return (
    <div
      ref={menu}
      className={className}
      style={style}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => (
        <div key={item.id} role="none">
          {item.separated && <div className="menu-separator" role="separator" />}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={item.disabled}
            aria-keyshortcuts={item.keyShortcuts}
            className={item.danger ? 'menu-item menu-item-danger' : 'menu-item'}
            onClick={() => {
              onClose(false);
              item.onSelect();
            }}
          >
            {item.label}
            {item.shortcut && (
              <span className="menu-shortcut" aria-hidden="true">
                {item.shortcut}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

interface MenuButtonProps {
  /** What the button is called for assistive technology, for example "Options for Q3 review". */
  readonly label: string;
  readonly items: readonly MenuItem[];
  /** Lets the owner return focus here after a dialog closes. */
  readonly triggerRef?: RefObject<HTMLButtonElement | null>;
  /** `card`: the three dots on a deck card. `toolbar`: a toolbar button with its own content. */
  readonly variant?: 'card' | 'toolbar';
  readonly children?: ReactNode;
}

export function MenuButton({
  label,
  items,
  triggerRef,
  variant = 'card',
  children,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const ownRef = useRef<HTMLButtonElement>(null);
  const button = triggerRef ?? ownRef;
  const menuId = useId();
  const toolbar = variant === 'toolbar';

  const trigger = (
    <button
      ref={button}
      type="button"
      className={toolbar ? 'toolbar-button' : 'menu-button'}
      aria-label={toolbar ? undefined : label}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={() => {
        setOpen((was) => !was);
      }}
    >
      {toolbar ? children : <DotsIcon />}
    </button>
  );

  const panel = open && (
    <MenuPanel
      label={label}
      items={items}
      ignore={button}
      onClose={(restoreFocus) => {
        setOpen(false);
        if (restoreFocus) button.current?.focus();
      }}
    />
  );

  if (!toolbar) {
    return (
      <>
        {trigger}
        {panel}
      </>
    );
  }
  return (
    <span className="menu-anchor">
      {trigger}
      {panel}
    </span>
  );
}

/** A menu opened by a right click, at the pointer. */
export function ContextMenu({
  label,
  items,
  x,
  y,
  onClose,
}: {
  readonly label: string;
  readonly items: readonly MenuItem[];
  readonly x: number;
  readonly y: number;
  readonly onClose: (restoreFocus: boolean) => void;
}) {
  // Keep it on screen: assume about 190 px wide and 36 px a row.
  const left = Math.max(8, Math.min(x, window.innerWidth - 200));
  const top = Math.max(8, Math.min(y, window.innerHeight - (items.length * 36 + 24)));
  return (
    <MenuPanel
      label={label}
      items={items}
      className="menu menu-context"
      style={{ left, top }}
      onClose={onClose}
    />
  );
}
