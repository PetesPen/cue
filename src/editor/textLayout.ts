import {
  applicableProps,
  isTextBox,
  normaliseProps,
  type ElementChange,
  type Slide,
  type TextElement,
} from '@/model';
import { measureTextHeight } from '@/render';

/**
 * A text box keeps its width and its height follows its text (EL-1). Whenever a change touches what
 * decides the height (the text, the width, the padding or the border), this adds the height the text
 * now needs, measured in the same layout the slide is drawn with. Changes to anything else, and to
 * shapes, pass through as they are.
 */

const LAYOUT_PROPS = ['doc', 'width', 'padding', 'border'] as const;

export function fitTextBoxes(slide: Slide, changes: readonly ElementChange[]): ElementChange[] {
  return changes.map((change) => {
    const element = slide.elements.find((e) => e.id === change.id);
    if (!element || !isTextBox(element)) return change;
    const props = applicableProps(element, normaliseProps(change.props));
    if (!LAYOUT_PROPS.some((key) => key in props)) return change;
    const next: TextElement = {
      ...element,
      width: props.width ?? element.width,
      padding: props.padding ?? element.padding,
      border: props.border ?? element.border,
      doc: props.doc ?? element.doc,
    };
    return { id: change.id, props: { ...change.props, height: measureTextHeight(next) } };
  });
}
