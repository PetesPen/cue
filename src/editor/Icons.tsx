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

export const ImageIcon = (props: IconProps) => (
  <Stroke strokeWidth={1.8} {...props}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 17 5-4.5 3.5 3L16 12l4.5 4.5" />
  </Stroke>
);

export const InfoIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Stroke>
);

export const UndoIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Stroke>
);

export const RedoIcon = (props: IconProps) => (
  <Stroke strokeWidth={2} {...props}>
    <path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Stroke>
);

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

/** A filled play triangle (Preview). */
export function PlayIcon({ size = 11 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 6 3.5z" />
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

export const FolderIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Stroke>
);

export const FileIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9.5 12.5l5 5M14.5 12.5l-5 5" />
  </Stroke>
);

export const DownloadIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </Stroke>
);

export const ArrowUpIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Stroke>
);

export const ArrowDownIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Stroke>
);

/** Two columns of dots: a row that can be dragged. */
export function GripIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.8" />
      <circle cx="15" cy="6" r="1.8" />
      <circle cx="9" cy="12" r="1.8" />
      <circle cx="15" cy="12" r="1.8" />
      <circle cx="9" cy="18" r="1.8" />
      <circle cx="15" cy="18" r="1.8" />
    </svg>
  );
}
