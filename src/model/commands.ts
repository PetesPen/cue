import { castDraft, enablePatches, produceWithPatches, type Patch } from 'immer';
import { createSlide, normaliseTitle, type Deck, type Id } from './deck';

enablePatches();

/**
 * Every edit is a command: plain data with its new ids and its time already filled in, so applying
 * it is pure and repeatable. Applying one yields the new deck plus patches and their inverse, which
 * give undo and redo (EL-8), autosave diffs (SV-1) and window sync (PM-3) from one mechanism.
 */
export type Command =
  | {
      readonly type: 'addSlide';
      readonly slideId: Id;
      readonly afterSlideId: Id;
      readonly at: number;
    }
  | { readonly type: 'renameDeck'; readonly title: string; readonly at: number };

export interface Applied {
  readonly deck: Deck;
  readonly patches: Patch[];
  /** Applying these to `deck` gives back the deck the command started from. */
  readonly inverse: Patch[];
}

export class CommandError extends Error {
  override readonly name = 'CommandError';
}

export function applyCommand(deck: Deck, command: Command): Applied {
  const [next, patches, inverse] = produceWithPatches(deck, (draft) => {
    switch (command.type) {
      case 'addSlide': {
        const index = draft.slides.findIndex((slide) => slide.id === command.afterSlideId);
        if (index === -1) {
          throw new CommandError(`Slide ${command.afterSlideId} is not in deck ${deck.id}`);
        }
        draft.slides.splice(index + 1, 0, castDraft(createSlide(command.slideId)));
        break;
      }
      case 'renameDeck':
        draft.title = normaliseTitle(command.title);
        break;
    }
    draft.updatedAt = command.at;
  });
  return { deck: next, patches, inverse };
}
