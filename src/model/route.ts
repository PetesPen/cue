/**
 * The addresses of Cue's screens, chosen by the address hash so refresh and links work with no server
 * setting (SV-2, PM-1). Pure: the editor and the show both read and write them, and neither imports the
 * other.
 *
 * - `#/` the deck library; `#/deck/<id>` the editor.
 * - `#/show/<id>` the presenter view (the editor tab during a show); `#/show/<id>/audience` the audience
 *   window; `#/show/<id>/single` the show in one window, without notes (PM-1). `?slide=<n>` (from 1)
 *   says where the show starts.
 */
export type ShowView = 'presenter' | 'audience' | 'single';

export type Route =
  | { readonly page: 'home' }
  | { readonly page: 'deck'; readonly deckId: string }
  | {
      readonly page: 'show';
      readonly deckId: string;
      readonly view: ShowView;
      /** Where the show starts, the slide's index from 0. */
      readonly slide: number;
    };

const DECK_PREFIX = '#/deck/';
const SHOW_PREFIX = '#/show/';
const SHOW_SUFFIX: Readonly<Record<ShowView, string>> = {
  presenter: '',
  audience: '/audience',
  single: '/single',
};

function safeDecode(part: string): string | undefined {
  try {
    return decodeURIComponent(part);
  } catch {
    return undefined;
  }
}

/** The slide a show starts at, from the hash's `slide` (from 1); a stray value is the first slide. */
function startSlide(query: string): number {
  const value = new URLSearchParams(query).get('slide');
  const number = value === null ? Number.NaN : Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 1 ? number - 1 : 0;
}

function showView(part: string | undefined): ShowView | undefined {
  if (part === undefined || part === '') return 'presenter';
  return part === 'audience' || part === 'single' ? part : undefined;
}

export function parseRoute(hash: string): Route {
  if (hash.startsWith(DECK_PREFIX)) {
    const deckId = safeDecode(hash.slice(DECK_PREFIX.length));
    if (deckId !== undefined && deckId !== '') return { page: 'deck', deckId };
  }
  if (hash.startsWith(SHOW_PREFIX)) {
    const rest = hash.slice(SHOW_PREFIX.length);
    const cut = rest.indexOf('?');
    const path = cut < 0 ? rest : rest.slice(0, cut);
    const query = cut < 0 ? '' : rest.slice(cut + 1);
    const parts = path.split('/');
    const deckId = safeDecode(parts[0] ?? '');
    const view = showView(parts[1]);
    if (deckId !== undefined && deckId !== '' && view && parts.length <= 2) {
      return { page: 'show', deckId, view, slide: startSlide(query) };
    }
  }
  return { page: 'home' };
}

export function routeHash(route: Route): string {
  if (route.page === 'home') return '#/';
  if (route.page === 'deck') return `${DECK_PREFIX}${encodeURIComponent(route.deckId)}`;
  const at = route.slide > 0 ? `?slide=${String(route.slide + 1)}` : '';
  return `${SHOW_PREFIX}${encodeURIComponent(route.deckId)}${SHOW_SUFFIX[route.view]}${at}`;
}
