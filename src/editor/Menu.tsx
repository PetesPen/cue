import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { DotsIcon } from './Icons';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly danger?: boolean;
  /** A divider above this item. */
  readonly separated?: boolean;
}

interface MenuButtonProps {
  /** What the button is called for assistive technology, for example "Options for Q3 review". */
  readonly label: string;
  readonly items: readonly MenuItem[];
  /** Lets the owner return focus here after a dialog closes. */
  readonly triggerRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * A three-dot button with a menu (design: Home, deck options). Opens with the first item focused;
 * Up, Down, Home and End move, Escape closes and returns focus, and so does clicking elsewhere.
 */
export function MenuButton({ label, items, triggerRef }: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const ownRef = useRef<HTMLButtonElement>(null);
  const button = triggerRef ?? ownRef;
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menu.current?.contains(target) || button.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, button]);

  function onKeyDown(event: KeyboardEvent) {
    const entries = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
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
      setOpen(false);
      button.current?.focus();
    } else if (event.key === 'Tab') setOpen(false);
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="menu-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        <DotsIcon />
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          className="menu"
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
                className={item.danger ? 'menu-item menu-item-danger' : 'menu-item'}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
