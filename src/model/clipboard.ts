import type { Id, SlideElement } from './elements';
import { InvalidDeckError, parseElement } from './parse';

/**
 * Elements on the clipboard (EL-7). They travel as JSON in a format of our own, so a paste brings
 * back exactly what was copied, text formatting included, and anything else on the clipboard is not
 * mistaken for them. The elements are checked on the way in, like those of a stored deck.
 */

export const CLIPBOARD_FORMAT = 'cue-elements';
export const CLIPBOARD_VERSION = 1;

export function serialiseElements(elements: readonly SlideElement[]): string {
  return JSON.stringify({ format: CLIPBOARD_FORMAT, version: CLIPBOARD_VERSION, elements });
}

/** The elements in some clipboard text, or nothing if it is not ours, or is damaged. */
export function parseElements(text: string): SlideElement[] | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const record = raw as { format?: unknown; version?: unknown; elements?: unknown };
  if (record.format !== CLIPBOARD_FORMAT || record.version !== CLIPBOARD_VERSION) return undefined;
  if (!Array.isArray(record.elements) || record.elements.length === 0) return undefined;
  try {
    return (record.elements as unknown[]).map(parseElement);
  } catch (error) {
    if (error instanceof InvalidDeckError) return undefined;
    throw error;
  }
}

/** New elements like these, with new ids, moved by `offset` slide pixels in both directions. */
export function copiesOf(
  elements: readonly SlideElement[],
  newId: () => Id,
  offset: number,
): SlideElement[] {
  return elements.map((element) => ({
    ...element,
    id: newId(),
    x: element.x + offset,
    y: element.y + offset,
  }));
}
