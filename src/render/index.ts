// render: the slide renderer and the motion engine, shared with the export runtime. Imports model.
export { createSlideRenderer, mountSlide } from './slide';
export type { SlideRenderer } from './slide';
export { arrowHead } from './shapes';
export { INDENT_STEP, createTextBody, ensureFonts, measureTextHeight, renderText } from './text';
