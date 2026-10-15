/** Icons from the design boards (24-unit grid, drawn with the current text colour). Decorative. */

interface IconProps {
  readonly size?: number;
  readonly strokeWidth?: number;
}

function Stroke({
  size = 16,
  strokeWidth = 1.8,
  children,
}: IconProps & { readonly children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
);

export const ShapeIcon = (props: IconProps) => (
  <Stroke {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </Stroke>
);

export const CheckIcon = (props: IconProps) => (
  <Stroke strokeWidth={2.4} {...props}>
    <path d="m5 12 5 5L20 7" />
  </Stroke>
);

export const AlertIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M12 8v5M12 17h.01" />
    <circle cx="12" cy="12" r="9" />
  </Stroke>
);

export const CloseIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Stroke>
);

export function DotsIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
