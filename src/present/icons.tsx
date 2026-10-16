/** The few icons the show windows use (design: Presenter). Drawn on a 24-unit grid in the text colour. */

interface IconProps {
  readonly size?: number;
}

function Stroke({ size = 16, children }: IconProps & { readonly children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ArrowLeftIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Stroke>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Stroke>
);

export const PauseIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M9 5v14M15 5v14" />
  </Stroke>
);

export const PlayIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M8 5l11 7-11 7z" />
  </Stroke>
);

export const ResetIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5" />
  </Stroke>
);

/** The Cue mark: a forest square with a yellow dot. Decorative. */
export function Logo() {
  return (
    <span className="pv-logo" aria-hidden="true">
      <span className="pv-logo-dot" />
    </span>
  );
}
