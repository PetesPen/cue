import { useRef } from 'react';
import {
  boundsOf,
  canReorder,
  fitBoxesTo,
  groupBounds,
  isLine,
  type Border,
  type DashStyle,
  type ElementChange,
  type ElementProps,
  type Id,
  type ReorderMode,
  type ShapeElement,
} from '@/model';
import { ColourField, MIXED, NumberField, Segmented, common } from './fields';
import { boxOf } from './gestures';
import { describeSelection } from './shapeLabels';

interface DesignPanelProps {
  /** The selected shapes as they are now, including a slider drag in progress. */
  readonly elements: readonly ShapeElement[];
  /** Every element on the slide, back to front: which Arrange buttons would do something. */
  readonly order: readonly Id[];
  /** Show a change without saving it (a slider being dragged). */
  readonly onPreview: (changes: readonly ElementChange[] | undefined) => void;
  /** Save a change: one command. */
  readonly onCommit: (changes: readonly ElementChange[]) => void;
  readonly onReorder: (mode: ReorderMode) => void;
}

const ARRANGE: readonly { readonly mode: ReorderMode; readonly label: string }[] = [
  { mode: 'front', label: 'Front' },
  { mode: 'forward', label: 'Forward' },
  { mode: 'backward', label: 'Backward' },
  { mode: 'back', label: 'Back' },
];

const DASHES: readonly { readonly value: DashStyle; readonly label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="panel-section" aria-label={title}>
      <h2 className="panel-title section-label">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The Design tab when something is selected (design: Main): position and size, opacity, arrange, and
 * the look of the shape. Values that differ across a multi-selection read "Mixed".
 */
export function DesignPanel({ elements, order, onPreview, onCommit, onReorder }: DesignPanelProps) {
  const ids = elements.map((e) => e.id);
  const only = elements.length === 1 ? elements[0] : undefined;
  const lines = elements.every((e) => isLine(e.shape));
  const anyRounded = elements.some((e) => e.shape === 'roundedRectangle');
  const hasFill = elements.some((e) => !isLine(e.shape));
  const pending = useRef<readonly ElementChange[] | undefined>(undefined);

  const apply = (props: ElementProps) => {
    onCommit(ids.map((id) => ({ id, props })));
  };
  const border = (patch: Partial<Border>) => {
    onCommit(elements.map((e) => ({ id: e.id, props: { border: { ...e.border, ...patch } } })));
  };

  // Position and size: one shape's own box, or the box around the whole selection.
  const bounds = only ? boxOf(only) : { ...groupBounds(elements.map(boxOf)), rotation: 0 };
  const setBounds = (patch: Partial<{ x: number; y: number; width: number; height: number }>) => {
    if (only) {
      apply(patch);
      return;
    }
    const target = { ...boundsOf(bounds), ...patch };
    const fitted = fitBoxesTo(elements.map(boxOf), target);
    onCommit(
      elements.map((e, i) => ({
        id: e.id,
        props: {
          x: fitted[i]?.x ?? e.x,
          y: fitted[i]?.y ?? e.y,
          width: fitted[i]?.width ?? e.width,
          height: fitted[i]?.height ?? e.height,
        },
      })),
    );
  };

  const opacity = common(elements, (e) => Math.round(e.opacity * 100));
  const previewOpacity = (percent: number) => {
    pending.current = ids.map((id) => ({ id, props: { opacity: percent / 100 } }));
    onPreview(pending.current);
  };
  const endOpacityDrag = () => {
    const changes = pending.current;
    pending.current = undefined;
    if (!changes) return;
    onPreview(undefined);
    onCommit(changes);
  };

  return (
    <div className="design-panel">
      <div className="panel-section panel-heading">
        <span className="panel-name">{describeSelection(elements.map((e) => e.shape))}</span>
      </div>

      <Section title="Position and size">
        <div className="field-grid">
          <NumberField
            label="X"
            shortLabel="X"
            value={bounds.x}
            onCommit={(x) => {
              setBounds({ x });
            }}
          />
          <NumberField
            label="Y"
            shortLabel="Y"
            value={bounds.y}
            onCommit={(y) => {
              setBounds({ y });
            }}
          />
          <NumberField
            label={lines ? 'Length' : 'Width'}
            shortLabel={lines ? 'L' : 'W'}
            value={bounds.width}
            min={1}
            onCommit={(width) => {
              setBounds({ width });
            }}
          />
          {!lines && (
            <NumberField
              label="Height"
              shortLabel="H"
              value={bounds.height}
              min={1}
              onCommit={(height) => {
                setBounds({ height });
              }}
            />
          )}
          {only && (
            <NumberField
              label={lines ? 'Angle' : 'Rotation'}
              shortLabel="°"
              value={Math.round(only.rotation * 100) / 100}
              min={-180}
              max={180}
              onCommit={(rotation) => {
                apply({ rotation });
              }}
            />
          )}
        </div>
      </Section>

      <Section title="Opacity">
        <div className="opacity-row">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            className="slider"
            aria-label="Opacity"
            value={opacity === MIXED ? 100 : opacity}
            onChange={(event) => {
              previewOpacity(Number(event.target.value));
            }}
            onPointerUp={endOpacityDrag}
            onKeyUp={endOpacityDrag}
            onBlur={endOpacityDrag}
          />
          <NumberField
            label="Opacity percent"
            shortLabel="%"
            value={opacity}
            min={0}
            max={100}
            onCommit={(percent) => {
              apply({ opacity: percent / 100 });
            }}
          />
        </div>
      </Section>

      <Section title="Arrange">
        <div className="arrange" role="group" aria-label="Arrange">
          {ARRANGE.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              className="arrange-button"
              disabled={!canReorder(order, new Set(ids), mode)}
              onClick={() => {
                onReorder(mode);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {hasFill && (
        <Section title="Fill">
          <ColourField
            label="Fill"
            allowNone
            value={common(
              elements.filter((e) => !isLine(e.shape)),
              (e) => e.fill,
            )}
            onChange={(fill) => {
              onCommit(
                elements
                  .filter((e) => !isLine(e.shape))
                  .map((e) => ({ id: e.id, props: { fill } })),
              );
            }}
          />
        </Section>
      )}

      <Section title={lines ? 'Line' : 'Border'}>
        <ColourField
          label={lines ? 'Line colour' : 'Border colour'}
          value={common(elements, (e) => e.border.color)}
          onChange={(color) => {
            border({ color });
          }}
        />
        <div className="field-grid panel-gap">
          <NumberField
            label={lines ? 'Line width' : 'Border width'}
            shortLabel="px"
            value={common(elements, (e) => e.border.width)}
            min={0}
            max={200}
            onCommit={(width) => {
              border({ width });
            }}
          />
        </div>
        <Segmented
          label="Dash style"
          value={common(elements, (e) => e.border.dash)}
          options={DASHES}
          onChange={(dash) => {
            border({ dash });
          }}
        />
      </Section>

      {anyRounded && (
        <Section title="Corners">
          <div className="field-grid">
            <NumberField
              label="Corner radius"
              shortLabel="R"
              value={common(
                elements.filter((e) => e.shape === 'roundedRectangle'),
                (e) => e.cornerRadius,
              )}
              min={0}
              max={1000}
              onCommit={(cornerRadius) => {
                onCommit(
                  elements
                    .filter((e) => e.shape === 'roundedRectangle')
                    .map((e) => ({ id: e.id, props: { cornerRadius } })),
                );
              }}
            />
          </div>
        </Section>
      )}
    </div>
  );
}
