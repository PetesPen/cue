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

export const TextIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M5 6V4h14v2M12 4v16M9 20h6" />
  </Stroke>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="m6 9 6 6 6-6" />
  </Stroke>
);

export const SearchIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Stroke>
);

export const AlignLeftIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
  </Stroke>
);

export const AlignCenterIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
  </Stroke>
);

export const AlignRightIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />
  </Stroke>
);

export const AlignJustifyIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </Stroke>
);

export const BulletsIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
  </Stroke>
);

export const NumbersIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v4M4 14h3l-3 3.5h3" />
  </Stroke>
);

export const IndentIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M4 6h16M11 10h9M11 14h9M4 18h16M4 9l3 3-3 3" />
  </Stroke>
);

export const OutdentIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M4 6h16M11 10h9M11 14h9M4 18h16M7 9l-3 3 3 3" />
  </Stroke>
);
