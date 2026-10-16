// render: the slide renderer and the motion engine, shared with the export runtime. Imports model.
export { createSlideRenderer, mountSlide } from './slide';
export type { SlideRenderer } from './slide';
export {
  EDITING,
  EDITING_FADE,
  PLAIN,
  RISE_DISTANCE,
  drawnOpacity,
  drawnTransform,
  lookSets,
} from './motion';
export type { Look } from './motion';
export { arrowHead } from './shapes';
export { imageSource, setImageSource } from './images';
export type { ImageSource } from './images';
export { INDENT_STEP, createTextBody, ensureFonts, measureTextHeight, renderText } from './text';
