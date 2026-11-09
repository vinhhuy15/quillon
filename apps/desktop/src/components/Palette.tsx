import { useState } from 'react';
import { displayLatex, PALETTES, type PaletteItem } from '../palette-data';
import { useUi } from '../state/store';
import { MathIcon } from './MathIcon';

export function Palette({ onInsert }: { onInsert: (latex: string) => void }) {
  const lang = useUi((s) => s.lang);
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('sciforge:palette-tab') ?? PALETTES[0].id;
    } catch {
      return PALETTES[0].id;
    }
  });
  const group = PALETTES.find((g) => g.id === tab) ?? PALETTES[0];

  const choose = (id: string) => {
    setTab(id);
    try {
      localStorage.setItem('sciforge:palette-tab', id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="palette">
      <div className="palette-tabs" role="tablist">
        {PALETTES.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={g.id === group.id}
            className={`palette-tab${g.id === group.id ? ' active' : ''}`}
            title={g.label[lang === 'vi' ? 0 : 1]}
            onClick={() => choose(g.id)}
          >
            <MathIcon latex={g.icon} size={14} maxWidth={44} />
            <span>{g.label[lang === 'vi' ? 0 : 1]}</span>
          </button>
        ))}
      </div>
      <div className={`palette-grid${group.wide ? ' wide' : ''}`} role="tabpanel">
        {group.items.map((item, i) => (
          <PaletteButton key={`${group.id}-${i}`} item={item} wide={!!group.wide} onInsert={onInsert} />
        ))}
      </div>
    </div>
  );
}

function PaletteButton({ item, wide, onInsert }: { item: PaletteItem; wide: boolean; onInsert: (latex: string) => void }) {
  return (
    <button
      className="palette-btn"
      title={item.t ?? item.i.replace(/#0|#\?/g, '□')}
      // Keep focus in the math field while clicking.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onInsert(item.i)}
    >
      <MathIcon latex={displayLatex(item)} size={wide ? 15 : 16} display={wide} maxWidth={wide ? 88 : 30} maxHeight={wide ? 42 : 30} />
    </button>
  );
}
