import { readFileSync } from 'node:fs';
import { isNumber, isRecord, isString } from './guards';

export interface Tokens {
  color: Record<string, string>;
  font: { ui: string; slideFamilies: string[] };
  space: number[];
  radius: Record<string, number>;
  layout: Record<string, number | number[]>;
  textPairs: [string, string][];
}

function isTokens(value: unknown): value is Tokens {
  if (!isRecord(value)) return false;
  const { color, font, space, radius, layout, textPairs } = value;
  return (
    isRecord(color) &&
    Object.values(color).every(isString) &&
    isRecord(font) &&
    isString(font.ui) &&
    Array.isArray(font.slideFamilies) &&
    font.slideFamilies.every(isString) &&
    Array.isArray(space) &&
    space.every(isNumber) &&
    isRecord(radius) &&
    Object.values(radius).every(isNumber) &&
    isRecord(layout) &&
    Object.values(layout).every(
      (entry) => isNumber(entry) || (Array.isArray(entry) && entry.every(isNumber)),
    ) &&
    Array.isArray(textPairs) &&
    textPairs.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(isString))
  );
}

/** Reads design/tokens.json and checks its shape at run time, so no cast is needed. */
export function loadTokens(): Tokens {
  const raw: unknown = JSON.parse(readFileSync('design/tokens.json', 'utf8'));
  if (!isTokens(raw)) throw new Error('design/tokens.json does not have the expected shape');
  return raw;
}
