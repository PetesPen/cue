// model: pure TypeScript, no DOM. Deck types, commands, undo, schema migrations. Imports no other module.
export {
  DEFAULT_DECK_TITLE,
  DEFAULT_SLIDE_BACKGROUND,
  SCHEMA_VERSION,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  createDeck,
  createSlide,
  duplicateDeck,
  normaliseTitle,
  systemEnv,
} from './deck';
export type { Deck, Env, Id, Slide, SlideElement } from './deck';
export { CommandError, applyCommand } from './commands';
export type { Applied, Command } from './commands';
export { InvalidDeckError, UnsupportedVersionError, parseDeck } from './parse';
