import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { parseRoute, routeHash, type Route } from './route';

describe('parseRoute (SV-2)', () => {
  test.each<[string, Route]>([
    ['', { page: 'home' }],
    ['#', { page: 'home' }],
    ['#/', { page: 'home' }],
    ['#/something-else', { page: 'home' }],
    ['#/deck/', { page: 'home' }],
    ['#/deck/%E0%A4%A', { page: 'home' }],
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

describe('the show routes (PM-1)', () => {
  test.each<[string, Route]>([
    ['#/show/d1', { page: 'show', deckId: 'd1', view: 'presenter', slide: 0 }],
    ['#/show/d1/', { page: 'show', deckId: 'd1', view: 'presenter', slide: 0 }],
    ['#/show/d1/audience', { page: 'show', deckId: 'd1', view: 'audience', slide: 0 }],
    ['#/show/d1/single', { page: 'show', deckId: 'd1', view: 'single', slide: 0 }],
    ['#/show/d1?slide=3', { page: 'show', deckId: 'd1', view: 'presenter', slide: 2 }],
    ['#/show/d1/audience?slide=12', { page: 'show', deckId: 'd1', view: 'audience', slide: 11 }],
    ['#/show/d1/audience?slide=0', { page: 'show', deckId: 'd1', view: 'audience', slide: 0 }],
    ['#/show/d1/audience?slide=x', { page: 'show', deckId: 'd1', view: 'audience', slide: 0 }],
    ['#/show/', { page: 'home' }],
    ['#/show/d1/elsewhere', { page: 'home' }],
    ['#/show/d1/audience/more', { page: 'home' }],
    ['#/show/%E0%A4%A', { page: 'home' }],
  ])('Given the address hash %j, When it is parsed, Then the route is %j', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  test('Given a show route, When its hash is built, Then the first slide leaves out the slide and the others count from 1', () => {
    expect(routeHash({ page: 'show', deckId: 'd', view: 'audience', slide: 0 })).toBe(
      '#/show/d/audience',
    );
    expect(routeHash({ page: 'show', deckId: 'd', view: 'presenter', slide: 4 })).toBe(
      '#/show/d?slide=5',
    );
  });

  test('Given any show route, When it goes into the hash and back, Then it is unchanged', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom('presenter', 'audience', 'single'),
        fc.integer({ min: 0, max: 500 }),
        (deckId, view, slide) => {
          const route: Route = { page: 'show', deckId, view, slide };

          expect(parseRoute(routeHash(route))).toEqual(route);
        },
      ),
    );
  });
});
