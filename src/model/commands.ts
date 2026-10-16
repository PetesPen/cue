import { castDraft, current, enablePatches, produceWithPatches, type Patch } from 'immer';
import { changeStep, type Step, type StepChange } from './animation';
import { createSlide, normaliseTitle, type Deck } from './deck';
import {
  applicableProps,
  normaliseProps,
  type ElementChange,
  type Id,
  type SlideElement,
} from './elements';
import { isEmptyText } from './richtext';
import { reorder, type ReorderMode } from './zorder';

enablePatches();

/** The first step of a slide always starts a click of its own, so it cannot be With previous. */
function firstOnClick(steps: { trigger: 'click' | 'with-previous' }[]): void {
  const first = steps[0];
  if (first && first.trigger !== 'click') first.trigger = 'click';
}

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
  | { readonly type: 'renameDeck'; readonly title: string; readonly at: number }
  /**
   * Take a slide out of the deck (SL-4). A deck always has a slide: deleting the only one leaves a
   * blank slide, whose id is `replacementId`.
   */
  | {
      readonly type: 'deleteSlide';
      readonly slideId: Id;
      readonly replacementId: Id;
      readonly at: number;
    }
  /** Put a slide at another place (SL-3): `toIndex` is its place in the order afterwards, from 0. */
  | {
      readonly type: 'moveSlide';
      readonly slideId: Id;
      readonly toIndex: number;
      readonly at: number;
    }
  /**
   * A copy of a slide right after it (SL-4): its background, its notes, every element and every
   * animation step, each with a new id (`elementIds` and `stepIds`, one for each in order); the
   * copied steps play on the copied elements.
   */
  | {
      readonly type: 'duplicateSlide';
      readonly slideId: Id;
      readonly newSlideId: Id;
      readonly elementIds: readonly Id[];
      readonly stepIds: readonly Id[];
      readonly at: number;
    }
  /** Put a new element on top of the slide (ZO-1: new elements are added on top). */
  | {
      readonly type: 'addElement';
      readonly slideId: Id;
      readonly element: SlideElement;
      readonly at: number;
    }
  /** Change properties of elements: move, resize, rotate, fade, restyle. One command per gesture. */
  | {
      readonly type: 'updateElements';
      readonly slideId: Id;
      readonly changes: readonly ElementChange[];
      readonly at: number;
    }
  /** Take elements off the slide (delete, cut). */
  | {
      readonly type: 'removeElements';
      readonly slideId: Id;
      readonly ids: readonly Id[];
      readonly at: number;
    }
  /** Put several new elements on top, in order (paste, duplicate). Their ids are new. */
  | {
      readonly type: 'addElements';
      readonly slideId: Id;
      readonly elements: readonly SlideElement[];
      readonly at: number;
    }
  /** The speaker notes of a slide (SL-6): plain text. */
  | {
      readonly type: 'setNotes';
      readonly slideId: Id;
      readonly notes: string;
      readonly at: number;
    }
  | {
      readonly type: 'reorderElements';
      readonly slideId: Id;
      readonly ids: readonly Id[];
      readonly mode: ReorderMode;
      readonly at: number;
    }
  /**
   * The background colour of a slide (SL-5), or of every slide with `all` (Apply to all slides). One
   * command either way, so it is one undo step. `slideId` is the slide being edited.
   */
  | {
      readonly type: 'setBackground';
      readonly slideId: Id;
      readonly background: string;
      readonly all: boolean;
      readonly at: number;
    }
  /** Put an animation step at the end of the slide's list (AN-1, AN-2). */
  | {
      readonly type: 'addStep';
      readonly slideId: Id;
      readonly step: Step;
      readonly at: number;
    }
  /**
   * Put a step at another place in the list (AN-5): `toIndex` is its place afterwards, from 0. A step
   * moved to the front becomes On click, because the first step always is (decision 26).
   */
  | {
      readonly type: 'moveStep';
      readonly slideId: Id;
      readonly stepId: Id;
      readonly toIndex: number;
      readonly at: number;
    }
  /** Change a step: its effect, style, trigger or timing (AN-1, AN-2, AN-4, AN-5). */
  | {
      readonly type: 'updateStep';
      readonly slideId: Id;
      readonly stepId: Id;
      readonly change: StepChange;
      readonly at: number;
    }
  | {
      readonly type: 'removeStep';
      readonly slideId: Id;
      readonly stepId: Id;
      readonly at: number;
    };

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
      case 'deleteSlide': {
        const index = draft.slides.findIndex((slide) => slide.id === command.slideId);
        if (index === -1)
          throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        if (draft.slides.length === 1) {
          draft.slides[0] = castDraft(createSlide(command.replacementId));
        } else {
          draft.slides.splice(index, 1);
        }
        break;
      }
      case 'moveSlide': {
        const index = draft.slides.findIndex((slide) => slide.id === command.slideId);
        if (index === -1)
          throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        const to = Math.min(draft.slides.length - 1, Math.max(0, Math.round(command.toIndex)));
        const [moved] = draft.slides.splice(index, 1);
        if (moved) draft.slides.splice(to, 0, moved);
        break;
      }
      case 'duplicateSlide': {
        const index = draft.slides.findIndex((slide) => slide.id === command.slideId);
        const original = draft.slides[index];
        if (!original) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        if (command.elementIds.length !== original.elements.length) {
          throw new CommandError('A copied slide needs one new id for each of its elements');
        }
        if (command.stepIds.length !== original.animations.length) {
          throw new CommandError('A copied slide needs one new id for each of its animation steps');
        }
        const copiedIds = new Map(original.elements.map((e, i) => [e.id, command.elementIds[i]]));
        const copy = {
          id: command.newSlideId,
          background: original.background,
          notes: original.notes,
          elements: original.elements.map((element, i) => ({
            ...current(element),
            id: command.elementIds[i] ?? element.id,
          })),
          animations: original.animations.map((step, i) => ({
            ...current(step),
            id: command.stepIds[i] ?? step.id,
            element: copiedIds.get(step.element) ?? step.element,
          })),
        };
        draft.slides.splice(index + 1, 0, castDraft(copy));
        break;
      }
      case 'addElement': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        if (slide.elements.some((e) => e.id === command.element.id)) {
          throw new CommandError(`Element ${command.element.id} is already on slide ${slide.id}`);
        }
        slide.elements.push(castDraft(command.element));
        break;
      }
      case 'updateElements': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        for (const change of command.changes) {
          const element = slide.elements.find((e) => e.id === change.id);
          if (!element) throw new CommandError(`Element ${change.id} is not on slide ${slide.id}`);
          Object.assign(element, applicableProps(element, normaliseProps(change.props)));
          // A shape whose words are all gone holds no text, so empty text has one stored form.
          if (element.kind === 'shape' && element.text && isEmptyText(element.text)) {
            delete element.text;
          }
        }
        break;
      }
      case 'removeElements': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        const gone = new Set(command.ids);
        slide.elements = slide.elements.filter((e) => !gone.has(e.id));
        // An element's steps go with it (AN-5).
        slide.animations = slide.animations.filter((step) => !gone.has(step.element));
        firstOnClick(slide.animations);
        break;
      }
      case 'addElements': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        for (const element of command.elements) {
          if (slide.elements.some((e) => e.id === element.id)) {
            throw new CommandError(`Element ${element.id} is already on slide ${slide.id}`);
          }
          slide.elements.push(castDraft(element));
        }
        break;
      }
      case 'setNotes': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        slide.notes = command.notes;
        break;
      }
      case 'reorderElements': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        const order = reorder(
          slide.elements.map((e) => e.id),
          new Set(command.ids),
          command.mode,
        );
        const byId = new Map(slide.elements.map((e) => [e.id, e]));
        slide.elements = order.flatMap((id) => byId.get(id) ?? []);
        break;
      }
      case 'addStep': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        if (!slide.elements.some((e) => e.id === command.step.element)) {
          throw new CommandError(`Element ${command.step.element} is not on slide ${slide.id}`);
        }
        if (slide.animations.some((a) => a.id === command.step.id)) {
          throw new CommandError(`Step ${command.step.id} is already on slide ${slide.id}`);
        }
        slide.animations.push(castDraft(command.step));
        firstOnClick(slide.animations);
        break;
      }
      case 'updateStep': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        const index = slide.animations.findIndex((a) => a.id === command.stepId);
        const step = slide.animations[index];
        if (!step) throw new CommandError(`Step ${command.stepId} is not on slide ${slide.id}`);
        const element = slide.elements.find((e) => e.id === step.element);
        slide.animations[index] = castDraft(
          changeStep(current(step), command.change, element ? current(element) : undefined),
        );
        firstOnClick(slide.animations);
        break;
      }
      case 'removeStep': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        if (!slide.animations.some((a) => a.id === command.stepId)) {
          throw new CommandError(`Step ${command.stepId} is not on slide ${slide.id}`);
        }
        slide.animations = slide.animations.filter((a) => a.id !== command.stepId);
        firstOnClick(slide.animations);
        break;
      }
      case 'moveStep': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        const index = slide.animations.findIndex((a) => a.id === command.stepId);
        if (index === -1) {
          throw new CommandError(`Step ${command.stepId} is not on slide ${slide.id}`);
        }
        const to = Math.min(slide.animations.length - 1, Math.max(0, Math.round(command.toIndex)));
        const [moved] = slide.animations.splice(index, 1);
        if (moved) slide.animations.splice(to, 0, moved);
        firstOnClick(slide.animations);
        break;
      }
      case 'setBackground': {
        const slide = draft.slides.find((s) => s.id === command.slideId);
        if (!slide) throw new CommandError(`Slide ${command.slideId} is not in deck ${deck.id}`);
        if (command.all) {
          for (const each of draft.slides) each.background = command.background;
        } else {
          slide.background = command.background;
        }
        break;
      }
    }
    draft.updatedAt = command.at;
  });
  return { deck: next, patches, inverse };
}
