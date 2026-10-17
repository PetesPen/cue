import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import {
  APPEAR_STYLES,
  DISAPPEAR_STYLES,
  EASINGS,
  MAX_DELAY,
  MAX_DURATION,
  MIN_DURATION,
  clickCount,
  clicksOf,
  type Id,
  type Slide,
  type SlideElement,
  type Step,
  type StepChange,
  type StepEffect,
} from '@/model';
import { NumberField, Segmented } from '../fields';
import { GripIcon, PlayIcon } from '../Icons';
import { useListDrag } from '../useListDrag';
import {
  APPEAR_STYLE_LABELS,
  DISAPPEAR_STYLE_LABELS,
  EASING_LABELS,
  EFFECT_LABELS,
  describeCounts,
  elementName,
  swatchOf,
} from './labels';
import { TimingSlider } from './TimingSlider';
import './animation.css';

interface AnimatePanelProps {
  readonly slide: Slide;
  /** The selected elements on the canvas. */
  readonly selectedIds: readonly Id[];
  /** The step whose settings are shown, if it still exists. */
  readonly activeStepId: Id | undefined;
  /** Choose a step in the list: its element is selected too. */
  readonly onSelectStep: (stepId: Id) => void;
  readonly onAdd: (element: Id, effect: StepEffect) => void;
  readonly onChange: (stepId: Id, change: StepChange) => void;
  readonly onRemove: (stepId: Id) => void;
  /** Put a step at another place in the list (drag, or Alt with the up and down arrows). */
  readonly onMove: (stepId: Id, toIndex: number) => void;
  readonly previewing: boolean;
  readonly onPreview: () => void;
}

/**
 * The Animate tab (design: Editor-Animate): the steps of this slide in play order, grouped by click,
 * with the settings of the one you chose and a Preview button.
 */
export function AnimatePanel({
  slide,
  selectedIds,
  activeStepId,
  onSelectStep,
  onAdd,
  onChange,
  onRemove,
  onMove,
  previewing,
  onPreview,
}: AnimatePanelProps) {
  const steps = slide.animations;
  const clicks = clicksOf(steps);
  const only =
    selectedIds.length === 1 ? slide.elements.find((e) => e.id === selectedIds[0]) : undefined;
  const active = steps.find((s) => s.id === activeStepId);
  const activeIndex = active ? steps.indexOf(active) : -1;
  const activeElement = active ? slide.elements.find((e) => e.id === active.element) : undefined;

  // Steps are put in order by dragging them (a line shows where one will land) or with the keyboard.
  const rows = useRef(new Map<string, HTMLElement>());
  const list = useRef<HTMLDivElement>(null);
  const { drag, startDrag, ignoreClick } = useListDrag({
    ids: steps.map((s) => s.id),
    rows,
    list,
    onMove,
  });

  return (
    <div className="animate-panel">
      <div className="panel-section animate-header">
        <div>
          <div className="panel-name">This slide</div>
          <div className="caption">{describeCounts(steps.length, clickCount(slide))}</div>
        </div>
        <button
          type="button"
          className="button button-compact"
          disabled={steps.length === 0}
          aria-pressed={previewing}
          onClick={onPreview}
        >
          {!previewing && <PlayIcon />}
          {previewing ? 'Stop preview' : 'Preview'}
        </button>
      </div>

      {steps.length === 0 ? (
        <p className="placeholder panel-section">
          No animations on this slide. Select an element, then choose Appear or Disappear.
        </p>
      ) : (
        <div ref={list} className="panel-section step-list" role="group" aria-label="Steps">
          {clicks.map((click, clickIndex) => (
            <div key={click[0]?.id ?? clickIndex} className="step-click">
              <h2 className="section-label">{`Click ${String(clickIndex + 1)}`}</h2>
              <ul className="step-rows">
                {click.map((step) => (
                  <li key={step.id}>
                    <StepRow
                      step={step}
                      element={slide.elements.find((e) => e.id === step.element)}
                      joins={step.trigger === 'with-previous' && click[0] !== step}
                      active={step.id === active?.id}
                      dragged={drag?.id === step.id}
                      register={(element) => {
                        if (element) rows.current.set(step.id, element);
                        else rows.current.delete(step.id);
                      }}
                      onPointerDown={(event) => {
                        startDrag(event, step.id);
                      }}
                      onMoveBy={(by) => {
                        const to = steps.indexOf(step) + by;
                        if (to < 0 || to >= steps.length) return;
                        onMove(step.id, to);
                        // The step keeps the focus in its new place once the list has been drawn again.
                        window.setTimeout(() => rows.current.get(step.id)?.focus(), 0);
                      }}
                      onSelect={() => {
                        if (!ignoreClick.current) onSelectStep(step.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {drag && drag.toIndex !== steps.findIndex((s) => s.id === drag.id) && (
            <div
              className="step-drop-line"
              style={{ top: `${String(drag.lineTop)}px` }}
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {active && activeElement && (
        <StepSettings
          key={active.id}
          step={active}
          index={activeIndex}
          name={elementName(activeElement)}
          onChange={(change) => {
            onChange(active.id, change);
          }}
          onRemove={() => {
            onRemove(active.id);
          }}
        />
      )}

      {only && (
        <div className="panel-section">
          <h2 className="section-label panel-title">{`Add a step for ${elementName(only)}`}</h2>
          <div className="segmented" role="group" aria-label="Add a step">
            {(['appear', 'disappear', 'move'] as const).map((effect) => (
              <button
                key={effect}
                type="button"
                className="segment"
                onClick={() => {
                  onAdd(only.id, effect);
                }}
              >
                {`+ ${EFFECT_LABELS[effect]}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** One row of the step list: the element's swatch and name, and what happens to it. */
function StepRow({
  step,
  element,
  joins,
  active,
  dragged,
  register,
  onPointerDown,
  onMoveBy,
  onSelect,
}: {
  readonly step: Step;
  readonly element: SlideElement | undefined;
  /** It plays with the step before it, not on a click of its own. */
  readonly joins: boolean;
  readonly active: boolean;
  readonly dragged: boolean;
  readonly register: (element: HTMLElement | null) => void;
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onMoveBy: (by: -1 | 1) => void;
  readonly onSelect: () => void;
}) {
  const name = element ? elementName(element) : 'Element';
  const effect = `${EFFECT_LABELS[step.effect]}${joins ? ' · with previous' : ''}`;
  return (
    <button
      ref={register}
      type="button"
      className={`step-row${active ? ' step-row-on' : ''}${dragged ? ' step-row-dragged' : ''}`}
      aria-current={active ? 'true' : undefined}
      aria-label={`${name}, ${effect.replace(' · ', ', ')}`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      data-step-id={step.id}
      onPointerDown={onPointerDown}
      onKeyDown={(event: KeyboardEvent) => {
        // Alt with the up and down arrows puts the step one place earlier or later.
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();
          onMoveBy(event.key === 'ArrowUp' ? -1 : 1);
        }
      }}
      onClick={onSelect}
    >
      <span className="step-grip" aria-hidden="true">
        <GripIcon />
      </span>
      <span
        className="step-swatch"
        style={element ? { background: swatchOf(element) } : undefined}
        aria-hidden="true"
      />
      <span className="step-name" aria-hidden="true">
        {name}
      </span>
      <span className="step-effect" aria-hidden="true">
        {effect}
      </span>
    </button>
  );
}

function StepSettings({
  step,
  index,
  name,
  onChange,
  onRemove,
}: {
  readonly step: Step;
  readonly index: number;
  readonly name: string;
  readonly onChange: (change: StepChange) => void;
  readonly onRemove: () => void;
}) {
  const first = index === 0;
  return (
    <section className="panel-section" aria-label="Step settings">
      <div className="panel-heading step-heading">
        <span className="panel-name">{`${name} · ${EFFECT_LABELS[step.effect]}`}</span>
        <span className="caption">{`Step ${String(index + 1)}`}</span>
      </div>

      <div className="panel-gap">
        <Segmented
          label="Effect"
          value={step.effect}
          options={(['appear', 'disappear', 'move'] as const).map((value) => ({
            value,
            label: EFFECT_LABELS[value],
          }))}
          onChange={(effect) => {
            onChange({ effect });
          }}
        />
      </div>
      <div className="panel-gap">
        <Segmented
          label="When"
          value={step.trigger}
          options={[
            { value: 'click', label: 'On click' },
            { value: 'with-previous', label: 'With previous', disabled: first },
          ]}
          onChange={(trigger) => {
            onChange({ trigger });
          }}
        />
      </div>
      <div className="panel-gap">
        {step.effect === 'move' ? (
          <div className="field-grid">
            <NumberField
              label="End X"
              shortLabel="X"
              value={step.x}
              onCommit={(x) => {
                onChange({ x });
              }}
            />
            <NumberField
              label="End Y"
              shortLabel="Y"
              value={step.y}
              onCommit={(y) => {
                onChange({ y });
              }}
            />
          </div>
        ) : step.effect === 'appear' ? (
          <Segmented
            label="Style"
            value={step.style}
            options={APPEAR_STYLES.map((value) => ({ value, label: APPEAR_STYLE_LABELS[value] }))}
            onChange={(style) => {
              onChange({ style });
            }}
          />
        ) : (
          <Segmented
            label="Style"
            value={step.style}
            options={DISAPPEAR_STYLES.map((value) => ({
              value,
              label: DISAPPEAR_STYLE_LABELS[value],
            }))}
            onChange={(style) => {
              onChange({ style });
            }}
          />
        )}
      </div>

      <TimingSlider
        label="Duration"
        value={step.duration}
        min={MIN_DURATION}
        max={MAX_DURATION}
        onCommit={(duration) => {
          onChange({ duration });
        }}
      />
      <TimingSlider
        label="Delay"
        value={step.delay}
        min={0}
        max={MAX_DELAY}
        onCommit={(delay) => {
          onChange({ delay });
        }}
      />

      <div className="panel-gap">
        <Segmented
          label="Easing"
          value={step.easing}
          options={EASINGS.map((value) => ({ value, label: EASING_LABELS[value] }))}
          onChange={(easing) => {
            onChange({ easing });
          }}
        />
      </div>

      <div className="step-remove">
        <button type="button" className="link-danger" onClick={onRemove}>
          Remove step
        </button>
      </div>
    </section>
  );
}
