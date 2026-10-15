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
export type { Deck, Env, Slide } from './deck';
export {
  DASH_STYLES,
  DEFAULT_BORDER_COLOR,
  DEFAULT_CORNER_RADIUS,
  DEFAULT_FILL,
  DEFAULT_LINE_WIDTH,
  SHAPE_KINDS,
  createShape,
  isLine,
  normaliseProps,
} from './elements';
export type {
  Border,
  BoxInput,
  DashStyle,
  ElementChange,
  ElementProps,
  Id,
  ShapeElement,
  ShapeKind,
  SlideElement,
} from './elements';
export { CommandError, applyCommand } from './commands';
export type { Applied, Command } from './commands';
export { InvalidDeckError, UnsupportedVersionError, parseDeck } from './parse';
export {
  HANDLES,
  angleOf,
  boundsOf,
  boxFromDrag,
  centerOf,
  containsPoint,
  cornersOf,
  fitBoxesTo,
  groupBounds,
  isCorner,
  lineBetween,
  lineEnds,
  moveBox,
  moveLineEnd,
  normaliseAngle,
  rectEncloses,
  resizeBox,
  resizeGroup,
  rotateBoxes,
  rotatePoint,
  rotationAfterDrag,
  scaleBoxes,
  snapTo,
  unionRect,
} from './geometry';
export type { Box, Handle, Point, Rect, ResizeOptions } from './geometry';
export { canReorder, reorder } from './zorder';
export type { ReorderMode } from './zorder';
