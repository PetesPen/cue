import type { Alignment } from '@/model';

/** Icons for aligning and distributing elements (EL-6): a line and the boxes lined up on it. Decorative. */

type Kind = Alignment | 'distribute-horizontal' | 'distribute-vertical';

const PATHS: Readonly<Record<Kind, string>> = {
  left: 'M4 3.5v17M8 7h11v4H8zM8 14h6v4H8z',
  centre: 'M12 3.5v17M5 7h14v4H5zM8 14h8v4H8z',
  right: 'M20 3.5v17M5 7h11v4H5zM10 14h6v4h-6z',
  top: 'M3.5 4h17M7 8h4v11H7zM14 8h4v6h-4z',
  middle: 'M3.5 12h17M7 5h4v14H7zM14 8h4v8h-4z',
  bottom: 'M3.5 20h17M7 5h4v11H7zM14 10h4v6h-4z',
  'distribute-horizontal': 'M4 3.5v17M20 3.5v17M9.5 7h5v10h-5z',
  'distribute-vertical': 'M3.5 4h17M3.5 20h17M7 9.5h10v5H7z',
};

export function AlignIcon({ kind, size = 16 }: { readonly kind: Kind; readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[kind]} />
    </svg>
  );
}
