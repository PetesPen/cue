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
  DEFAULT_TEXT_HEIGHT,
  DEFAULT_TEXT_WIDTH,
  applicableProps,
  createImage,
  createShape,
  createText,
  isLine,
  isShape,
  isImage,
  isTextBox,
  normaliseProps,
} from './elements';
export type {
  Border,
  BoxInput,
  DashStyle,
  ElementChange,
  ElementProps,
  Id,
  ImageElement,
  ShapeElement,
  ShapeKind,
  SlideElement,
  TextElement,
} from './elements';
export { imageHashes } from './images';
export { CommandError, applyCommand } from './commands';
export type { Applied, Command } from './commands';
export { InvalidDeckError, UnsupportedVersionError, parseDeck } from './parse';
export {
  HISTORY_LIMIT,
  MERGE_WINDOW_MS,
  canRedo,
  canUndo,
  emptyHistory,
  record,
  redo,
  redoLabel,
  undo,
  undoLabel,
} from './history';
export type { History, HistoryEntry, Stepped } from './history';
export {
  CLIPBOARD_FORMAT,
  CLIPBOARD_VERSION,
  copiesOf,
  parseElements,
  serialiseElements,
} from './clipboard';
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
  handleEdges,
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
export {
  ALIGNS,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_TEXT_STYLE,
  InvalidTextError,
  MAX_INDENT,
  MIXED,
  emptyText,
  fontsUsed,
  indentText,
  isEmptyText,
  listKind,
  normaliseColour,
  paragraphs,
  plainText,
  restyleText,
  sanitiseRichText,
  setListKind,
  summariseStyle,
  summariseText,
  textFromString,
  textRuns,
} from './richtext';
export type {
  Align,
  Block,
  Inline,
  ListBlock,
  ListItem,
  ListKind,
  Mixed,
  Paragraph,
  ParagraphAttrs,
  RichText,
  StyleChange,
  StyleSummary,
  TextMark,
  TextStyleAttrs,
  TextSummary,
} from './richtext';
export { DEFAULT_FONT, FONTS, fontCapabilities, isBundledFont } from './fonts';
export type { FontInfo, FontKind } from './fonts';
export {
  APPEAR_STYLES,
  DEFAULT_APPEAR_STYLE,
  DEFAULT_DELAY,
  DEFAULT_DISAPPEAR_STYLE,
  DEFAULT_DURATION,
  DEFAULT_EASING,
  DEFAULT_MOVE_OFFSET,
  DISAPPEAR_STYLES,
  EASINGS,
  MAX_DELAY,
  MAX_DURATION,
  MIN_DURATION,
  TRIGGERS,
  changeStep,
  clampDelay,
  clampDuration,
  createStep,
  defaultMoveEnd,
  isAppearStyle,
  isDisappearStyle,
  isEasing,
  isStepEffect,
  isTrigger,
} from './animation';
export type {
  AppearStep,
  AppearStyle,
  DisappearStep,
  DisappearStyle,
  Easing,
  MoveStep,
  Place,
  Step,
  StepChange,
  StepEffect,
  Trigger,
} from './animation';
export {
  DEFAULT_TRANSITION,
  DEFAULT_TRANSITION_DURATION,
  MAX_TRANSITION_DURATION,
  MIN_TRANSITION_DURATION,
  TRANSITION_KINDS,
  TRANSITION_SIDES,
  changeTransition,
  clampTransitionDuration,
  isTransitionKind,
  isTransitionSide,
} from './transition';
export type { Transition, TransitionKind, TransitionSide } from './transition';
export { clickCount, clickOfStep, clicksOf, playsFor, resolve, stepsOf } from './motion';
export type { SlideState } from './motion';
export {
  ALIGNMENTS,
  align,
  distribute,
  guideAt,
  nudged,
  snapEdges,
  snapHandle,
  snapMove,
} from './snap';
export type { Alignment, Edges, Guide, Placed, Shift, SnapLine, Snapped } from './snap';
export {
  back,
  clampPlace,
  forward,
  jumpTo,
  movement,
  startShow,
  toEnd,
  toStart,
  toggleBlank,
  upcoming,
  upcomingLabel,
} from './show';
export type { Blank, Movement, ShowPlace, Upcoming } from './show';
export { parseRoute, routeHash } from './route';
export type { Route, ShowView } from './route';
export {
  MAX_DIGITS,
  NUMBER_WAIT_MS,
  PAGE_KEYS,
  SHOW_KEYS,
  pageActionFor,
  showActionFor,
  typeDigit,
} from './showkeys';
export type { PageAction, PageKey, ShowAction, ShowKey } from './showkeys';
