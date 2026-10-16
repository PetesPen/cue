import { describe, expect, test } from 'vitest';
import { createSlide, type Deck } from './deck';
import { createImage, createShape, isImage } from './elements';
import { imageHashes } from './images';
import { parseDeck } from './parse';

const deck = (...elements: Deck['slides'][number]['elements'][number][]): Deck => ({
  schemaVersion: 1,
  id: 'deck',
  title: 'Deck',
  createdAt: 1,
  updatedAt: 1,
  slides: [{ ...createSlide('s1'), elements }, createSlide('s2')],
});

const picture = (id: string, hash: string) =>
  createImage(id, hash, { x: 10, y: 20, width: 300, height: 200 }, 'A group photo');

describe('pictures in a deck (EL-4)', () => {
  test('Given a deck with pictures, When they are listed, Then each hash is there once', () => {
    const d = deck(picture('a', 'h1'), picture('b', 'h1'), picture('c', 'h2'));

    expect([...imageHashes(d)].sort()).toEqual(['h1', 'h2']);
  });

  test('Given a deck with no pictures, When they are listed, Then there are none', () => {
    expect(
      imageHashes(deck(createShape('s', 'ellipse', { x: 0, y: 0, width: 5, height: 5 }))),
    ).toEqual(new Set());
  });

  test('Given a picture, When the deck is stored as JSON and read back, Then the picture is the same', () => {
    const d = deck({ ...picture('a', 'h1'), opacity: 0.5, rotation: 12 });

    expect(parseDeck(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  test('Given a picture with no hash or no description, When the deck is read, Then it is refused', () => {
    const bad = (patch: object): unknown =>
      JSON.parse(JSON.stringify(deck({ ...picture('a', 'h1'), ...patch })));

    expect(() => parseDeck(bad({ hash: '' }))).toThrow();
    expect(() => parseDeck(bad({ hash: 7 }))).toThrow();
    expect(() => parseDeck(bad({ alt: undefined }))).toThrow();
  });

  test('Given a picture, When it is asked what it is, Then it is an image with the description and no fill', () => {
    const image = picture('a', 'h1');

    expect(isImage(image)).toBe(true);
    expect(image).toMatchObject({ kind: 'image', alt: 'A group photo', fill: 'none' });
    expect(image.border.width).toBe(0);
  });
});
