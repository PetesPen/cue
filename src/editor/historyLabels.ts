import type { Command, ElementChange, Id } from '@/model';

/** What a step is called in the undo and redo buttons, and which elements it was about. */

const keysOf = (changes: readonly ElementChange[]): Set<string> =>
  new Set(changes.flatMap((change) => Object.keys(change.props)));

/** A name for a change of properties: "Move", "Resize", "Fade" ... */
export function labelForChanges(changes: readonly ElementChange[]): string {
  const keys = keysOf(changes);
  const only = (...allowed: string[]) => [...keys].every((key) => allowed.includes(key));
  if (keys.has('doc') || keys.has('text')) return 'Edit text';
  if (only('x', 'y')) return 'Move';
  if (keys.has('width') || keys.has('height')) return 'Resize';
  if (only('rotation')) return 'Rotate';
  if (only('opacity')) return 'Fade';
  if (only('fill', 'border', 'cornerRadius')) return 'Change look';
  return 'Change';
}

export function labelFor(command: Command): string {
  switch (command.type) {
    case 'addSlide':
      return 'Add slide';
    case 'renameDeck':
      return 'Rename deck';
    case 'deleteSlide':
      return 'Delete slide';
    case 'moveSlide':
      return 'Move slide';
    case 'duplicateSlide':
      return 'Duplicate slide';
    case 'addElement':
      return 'Add';
    case 'updateElements':
      return labelForChanges(command.changes);
    case 'removeElements':
      return 'Delete';
    case 'addElements':
      return 'Paste';
    case 'setNotes':
      return 'Edit notes';
    case 'reorderElements':
      return 'Arrange';
    case 'setBackground':
      return command.all ? 'Change all backgrounds' : 'Change background';
  }
}

/** The elements a command was about: selected again after it is undone or redone, where they exist. */
export function idsOf(command: Command): Id[] {
  switch (command.type) {
    case 'addElement':
      return [command.element.id];
    case 'addElements':
      return command.elements.map((element) => element.id);
    case 'updateElements':
      return command.changes.map((change) => change.id);
    case 'removeElements':
    case 'reorderElements':
      return [...command.ids];
    case 'addSlide':
    case 'renameDeck':
    case 'setNotes':
    case 'deleteSlide':
    case 'moveSlide':
    case 'duplicateSlide':
    case 'setBackground':
      return [];
  }
}
