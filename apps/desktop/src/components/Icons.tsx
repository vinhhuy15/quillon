/** 16px line icons drawn for SciForge (currentColor, 1.4px strokes). */
import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  select: <path d="M3.5 2.5 12 8.2l-3.7.7 2.1 4.2-1.6.8-2.1-4.2L4 12.3z" strokeLinejoin="round" />,
  hand: (
    <path d="M5.5 8.5V4a1 1 0 0 1 2 0v3.5m0-4.5a1 1 0 0 1 2 0v4.5m0-3.5a1 1 0 0 1 2 0V9m0-2.5a1 1 0 0 1 2 0V10a4 4 0 0 1-4 4H9a4 4 0 0 1-3.2-1.6L3.4 9.2a1 1 0 0 1 1.5-1.3l.6.6" strokeLinejoin="round" />
  ),
  math: <path d="M12 3H4.5l4 5-4 5H12" strokeLinejoin="round" />,
  text: <path d="M3.5 4V2.8h9V4M8 2.8v10.4m-2 0h4" />,
  rect: <rect x="2.5" y="3.5" width="11" height="9" rx="0.5" />,
  ellipse: <ellipse cx="8" cy="8" rx="5.5" ry="4.5" />,
  line: <path d="M3 13 13 3" />,
  arrow: (
    <>
      <path d="M3 13 12.2 3.8" />
      <path d="M7.5 3.2h5.3v5.3" strokeLinejoin="round" />
    </>
  ),
  plot: (
    <>
      <path d="M2.5 2v11.5H14" />
      <path d="M4 11c1.5-6 3-7 4.5-4s3 2.5 4.5-3" />
    </>
  ),
  shapes: (
    <>
      <rect x="2" y="2" width="6" height="6" rx="0.5" />
      <circle cx="11" cy="11" r="3" />
      <path d="M11 2.2 14 7H8z" strokeLinejoin="round" />
    </>
  ),
  symbol: <path d="M1.5 8h3l1-2.5 2 5 2-5 2 5 1-2.5h2" strokeLinejoin="round" />,
  template: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
      <path d="M5 6h6M5 8.5h4M5 11h5" />
    </>
  ),
  library: <path d="M8 2.5l1.7 3.4 3.8.5-2.8 2.6.7 3.7L8 11l-3.4 1.7.7-3.7-2.8-2.6 3.8-.5z" strokeLinejoin="round" />,
  undo: <path d="M5.5 4 2.5 7l3 3M3 7h6.5a3.5 3.5 0 0 1 0 7H8" strokeLinejoin="round" />,
  redo: <path d="M10.5 4l3 3-3 3M13 7H6.5a3.5 3.5 0 0 0 0 7H8" strokeLinejoin="round" />,
  export: <path d="M8 10V2.5M5 5.2l3-2.9 3 2.9M3 9.5v3.8h10V9.5" strokeLinejoin="round" />,
  word: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1" />
      <path d="m4.5 5.5 1.2 5 1.3-3.6 1.3 3.6 1.2-5" strokeLinejoin="round" />
      <path d="M11 6.5h1.2M11 9h1.2" />
    </>
  ),
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
      <path d="M10.5 3.5V3a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h.5" />
    </>
  ),
  trash: <path d="M2.5 4.5h11M6 4.5V3h4v1.5m-5.5 0 .6 8.5h5.8l.6-8.5M6.8 7v4M9.2 7v4" strokeLinejoin="round" />,
  plus: <path d="M8 3v10M3 8h10" />,
  minus: <path d="M3 8h10" />,
  close: <path d="m4 4 8 8m0-8-8 8" />,
  fit: <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" strokeLinejoin="round" />,
  chevronDown: <path d="m4.5 6.5 3.5 3.5 3.5-3.5" strokeLinejoin="round" />,
  chevronRight: <path d="m6.5 4.5 3.5 3.5-3.5 3.5" strokeLinejoin="round" />,
  panel: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1" />
      <path d="M6 2.5v11" />
    </>
  ),
  dock: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1" />
      <path d="M2 9.5h12" />
    </>
  ),
  grid: <path d="M2.5 5.5h11M2.5 10.5h11M5.5 2.5v11M10.5 2.5v11" />,
  alignLeft: <path d="M2.5 2v12M5 4.5h8v2.5H5zM5 9.5h5V12H5z" strokeLinejoin="round" />,
  alignHCenter: <path d="M8 2v12M3.5 4.5h9v2.5h-9zM5 9.5h6V12H5z" strokeLinejoin="round" />,
  alignRight: <path d="M13.5 2v12M3 4.5h8v2.5H3zM6 9.5h5V12H6z" strokeLinejoin="round" />,
  alignTop: <path d="M2 2.5h12M4.5 5h2.5v8H4.5zM9.5 5H12v5H9.5z" strokeLinejoin="round" />,
  alignVCenter: <path d="M2 8h12M4.5 3.5H7v9H4.5zM9.5 5H12v6H9.5z" strokeLinejoin="round" />,
  alignBottom: <path d="M2 13.5h12M4.5 3H7v8H4.5zM9.5 6H12v5H9.5z" strokeLinejoin="round" />,
  distH: <path d="M2.5 2v12M13.5 2v12M6.5 5h3v6h-3z" strokeLinejoin="round" />,
  distV: <path d="M2 2.5h12M2 13.5h12M5 6.5h6v3H5z" strokeLinejoin="round" />,
  group: (
    <>
      <path d="M2.5 4.5v-2h2M11.5 2.5h2v2M13.5 11.5v2h-2M4.5 13.5h-2v-2" />
      <rect x="5" y="5" width="6" height="6" rx="0.5" />
    </>
  ),
  ungroup: (
    <>
      <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="0.5" />
      <rect x="8" y="8" width="5.5" height="5.5" rx="0.5" strokeDasharray="1.6 1.4" />
    </>
  ),
  lock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </>
  ),
  unlock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 4.9-.7" />
    </>
  ),
  rotate: <path d="M12.8 6.5A5 5 0 1 0 13 9.5M13 3v3.5H9.5" strokeLinejoin="round" />,
  flip: <path d="M8 2v12M6 4.5 2.5 12H6zM10 4.5l3.5 7.5H10z" strokeLinejoin="round" />,
  front: (
    <>
      <rect x="2.5" y="2.5" width="7" height="7" rx="0.5" strokeDasharray="1.6 1.4" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="0.5" fill="currentColor" fillOpacity="0.18" />
    </>
  ),
  back: (
    <>
      <rect x="2.5" y="2.5" width="7" height="7" rx="0.5" fill="currentColor" fillOpacity="0.18" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="0.5" strokeDasharray="1.6 1.4" />
    </>
  ),
  help: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M6.3 6.3a1.8 1.8 0 1 1 2.5 1.6c-.5.3-.8.6-.8 1.2v.4M8 11.3v.2" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4" />
      <path d="m10 10 3.5 3.5" />
    </>
  ),
  latex: <path d="M2 5h3M3.5 5v6M6 8h3M7.5 8v3.5M10 4.5l4 7m0-7-4 7" />,
  none: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
      <path d="m3 13 10-10" />
    </>
  ),
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      aria-hidden
    >
      {P[name]}
    </svg>
  );
}

/** Small previews of line end caps for the inspector. */
export function CapIcon({ cap, flip }: { cap: string; flip?: boolean }) {
  const head =
    cap === 'arrow' ? <path d="M17 6 11 3v6z" fill="currentColor" stroke="none" />
    : cap === 'open' ? <path d="M12 2.5 17 6l-5 3.5" fill="none" />
    : cap === 'dot' ? <circle cx="15.5" cy="6" r="2.4" fill="currentColor" stroke="none" />
    : cap === 'bar' ? <path d="M16.5 2v8" />
    : null;
  return (
    <svg width="22" height="12" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d={`M2 6h${cap === 'arrow' ? 10 : 14}`} />
      {head}
    </svg>
  );
}
