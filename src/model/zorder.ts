import type { Id } from './elements';

/**
 * Order of elements is back to front: the first is at the back, the last is on top. These commands
 * move the selected ones and keep what ZO-1 promises: the selected elements keep their order among
 * themselves, and so do the ones that are not selected.
 */
export type ReorderMode = 'front' | 'forward' | 'backward' | 'back';

/** The new back-to-front order of `order` after moving `selected`. Unknown ids are ignored. */
export function reorder(order: readonly Id[], selected: ReadonlySet<Id>, mode: ReorderMode): Id[] {
  const next = [...order];
  const isSelected = (id: Id | undefined) => id !== undefined && selected.has(id);

  if (mode === 'front' || mode === 'back') {
    const picked = next.filter((id) => selected.has(id));
    const rest = next.filter((id) => !selected.has(id));
    return mode === 'front' ? [...rest, ...picked] : [...picked, ...rest];
  }

  // One step: each selected element swaps with the unselected one directly above (or below) it.
  // Going from the far end keeps a block of selected elements together as it moves.
  if (mode === 'forward') {
    for (let i = next.length - 2; i >= 0; i--) {
      if (isSelected(next[i]) && !isSelected(next[i + 1])) swap(next, i, i + 1);
    }
  } else {
    for (let i = 1; i < next.length; i++) {
      if (isSelected(next[i]) && !isSelected(next[i - 1])) swap(next, i, i - 1);
    }
  }
  return next;
}

/** False when the command would change nothing: the toolbar disables it (ZO-1). */
export function canReorder(
  order: readonly Id[],
  selected: ReadonlySet<Id>,
  mode: ReorderMode,
): boolean {
  if (![...selected].some((id) => order.includes(id))) return false;
  const next = reorder(order, selected, mode);
  return next.some((id, index) => id !== order[index]);
}

function swap(list: Id[], a: number, b: number): void {
  const held = list[a];
  const other = list[b];
  if (held === undefined || other === undefined) return;
  list[a] = other;
  list[b] = held;
}
