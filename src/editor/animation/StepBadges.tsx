import { SLIDE_HEIGHT, SLIDE_WIDTH, boundsOf, clickOfStep, type Slide } from '@/model';
import { boxOf } from '../gestures';

interface StepBadgesProps {
  readonly slide: Slide;
  /** The step whose settings are open: its badge is green. */
  readonly activeStepId: string | undefined;
}

/**
 * One numbered badge for each step, at the top right of its element: the number of the click it plays
 * on (design: Editor-Animate). An overlay only: it is not in thumbnails, in Preview or in the show.
 * Placed in percentages of the slide, so it needs no knowledge of the zoom.
 */
export function StepBadges({ slide, activeStepId }: StepBadgesProps) {
  const groups = slide.elements.flatMap((element) => {
    const steps = slide.animations.flatMap((step, index) =>
      step.element === element.id ? [{ step, click: clickOfStep(slide.animations, index) }] : [],
    );
    return steps.length === 0 ? [] : [{ element, steps }];
  });
  if (groups.length === 0) return null;

  return (
    <div className="step-badges" aria-hidden="true">
      {groups.map(({ element, steps }) => {
        const bounds = boundsOf(boxOf(element));
        return (
          <div
            key={element.id}
            className="step-badge-group"
            style={{
              left: `${String(((bounds.x + bounds.width) / SLIDE_WIDTH) * 100)}%`,
              top: `${String((bounds.y / SLIDE_HEIGHT) * 100)}%`,
            }}
          >
            {steps.map(({ step, click }) => (
              <span
                key={step.id}
                className={step.id === activeStepId ? 'step-badge step-badge-on' : 'step-badge'}
                data-step-id={step.id}
              >
                {click}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
