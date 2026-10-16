import type { ReactNode } from 'react';
import { MIXED, type Align } from '@/model';
import { ColourField, NumberField } from '../fields';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BulletsIcon,
  IndentIcon,
  NumbersIcon,
  OutdentIcon,
} from '../Icons';
import { FontPicker } from './FontPicker';
import type { TextFormat } from './format';
import { StyleButtons, Toggle, keepSelection } from './Toolbar';

const ALIGNS: readonly {
  readonly align: Align;
  readonly label: string;
  readonly icon: ReactNode;
}[] = [
  { align: 'left', label: 'Align left', icon: <AlignLeftIcon /> },
  { align: 'center', label: 'Align centre', icon: <AlignCenterIcon /> },
  { align: 'right', label: 'Align right', icon: <AlignRightIcon /> },
  { align: 'justify', label: 'Justify', icon: <AlignJustifyIcon /> },
];

const MIN_SIZE = 1;
const MAX_SIZE = 1000;
const MIN_LINE = 0.5;
const MAX_LINE = 5;

interface Props {
  readonly format: TextFormat;
  readonly deckFonts: readonly string[];
}

/**
 * The Text section of the Design tab (design: Editor-Text): font, size, line spacing, style buttons
 * and colour, then the paragraph options. It changes the words selected in the editor, or all the
 * text of the selected boxes, whichever `format` is.
 */
export function TextSection({ format, deckFonts }: Props) {
  const { summary } = format;
  return (
    // Pressing a button keeps the words selected in the editor; the fields inside still take focus.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="text-section" onMouseDown={keepSelection}>
      <FontPicker
        value={summary.fontFamily}
        deckFonts={deckFonts}
        onChange={(fontFamily) => {
          format.apply({ fontFamily });
        }}
      />
      <div className="field-grid panel-gap">
        <NumberField
          label="Font size"
          shortLabel="Size"
          value={summary.fontSize}
          min={MIN_SIZE}
          max={MAX_SIZE}
          onCommit={(fontSize) => {
            format.apply({ fontSize: Math.round(fontSize) });
          }}
        />
        <NumberField
          label="Line spacing"
          shortLabel="Line"
          value={summary.lineHeight}
          min={MIN_LINE}
          max={MAX_LINE}
          step={0.1}
          onCommit={(lineHeight) => {
            format.apply({ lineHeight });
          }}
        />
      </div>
      <div className="tool-row panel-gap" role="group" aria-label="Text style">
        <StyleButtons format={format} />
      </div>
      <div className="panel-gap">
        <ColourField
          label="Text colour"
          value={summary.color}
          onChange={(color) => {
            format.apply({ color });
          }}
        />
      </div>
      <div className="tool-row panel-gap" role="group" aria-label="Paragraph">
        {ALIGNS.map(({ align, label, icon }) => (
          <Toggle
            key={align}
            label={label}
            pressed={summary.align === align}
            onClick={() => {
              format.apply({ align });
            }}
          >
            {icon}
          </Toggle>
        ))}
        <Toggle
          label="Bulleted list"
          pressed={summary.list === 'bulletList'}
          onClick={() => {
            format.setList(summary.list === 'bulletList' ? 'none' : 'bulletList');
          }}
        >
          <BulletsIcon />
        </Toggle>
        <Toggle
          label="Numbered list"
          pressed={summary.list === 'orderedList'}
          onClick={() => {
            format.setList(summary.list === 'orderedList' ? 'none' : 'orderedList');
          }}
        >
          <NumbersIcon />
        </Toggle>
        <button
          type="button"
          className="tool-button"
          aria-label="Indent less"
          title="Indent less"
          disabled={summary.indent !== MIXED && summary.indent === 0 && summary.list === 'none'}
          onClick={() => {
            format.indent(-1);
          }}
        >
          <OutdentIcon />
        </button>
        <button
          type="button"
          className="tool-button"
          aria-label="Indent more"
          title="Indent more"
          onClick={() => {
            format.indent(1);
          }}
        >
          <IndentIcon />
        </button>
      </div>
    </div>
  );
}
