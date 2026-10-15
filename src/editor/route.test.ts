import { describe, expect, test } from 'vitest';
import { parseRoute, routeHash } from './route';

describe('parseRoute (SV-2)', () => {
  test.each([
    ['', { page: 'home' }],
    ['#', { page: 'home' }],
    ['#/', { page: 'home' }],
    ['#/something-else', { page: 'home' }],
    ['#/deck/', { page: 'home' }],
    ['#/deck/abc-123', { page: 'deck', deckId: 'abc-123' }],
  ])('Given the address hash %j, When it is parsed, Then the screen is %j', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  test('Given a deck id with characters that need escaping, When it goes into the hash and back, Then it is unchanged', () => {
    const route = { page: 'deck', deckId: 'a b/c?d#e' } as const;

    expect(parseRoute(routeHash(route))).toEqual(route);
  });

  test('Given the home screen, When its hash is built, Then it is "#/"', () => {
    expect(routeHash({ page: 'home' })).toBe('#/');
  });
});
