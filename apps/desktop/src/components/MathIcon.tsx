import { memo, useMemo } from 'react';
import { layoutMath } from '@quillon/math-core';

/** Small static rendering of LaTeX (palette buttons, template cards). Inherits CSS color. */
export const MathIcon = memo(function MathIcon({
  latex,
  size = 15,
  display = false,
  maxWidth = Infinity,
  maxHeight = Infinity,
}: {
  latex: string;
  size?: number;
  display?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}) {
  const l = useMemo(() => layoutMath(latex, display, size, 'currentColor'), [latex, display, size]);
  const scale = Math.min(1, maxWidth / l.width, maxHeight / l.height);
  return (
    <svg
      className="math-icon"
      width={l.width * scale}
      height={l.height * scale}
      viewBox={`0 0 ${l.width} ${l.height}`}
      aria-label={latex}
      dangerouslySetInnerHTML={{ __html: l.markup }}
    />
  );
});
