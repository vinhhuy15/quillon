import { insertImage } from '../actions';
import { useT } from '../i18n';
import { persist, ui, useUi } from '../state/store';
import { setTool, TOOLS } from '../tools';
import { Icon } from './Icons';
import { togglePanel } from './TopBar';

export function ToolRail() {
  const t = useT();
  const tool = useUi((s) => s.tool);
  const panelOpen = useUi((s) => s.panelOpen);
  const panelTab = useUi((s) => s.panelTab);
  return (
    <nav className="tool-rail" aria-label={t('tools')}>
      {TOOLS.map((d, i) =>
        d === 'sep' ? (
          <span key={i} className="rail-sep" />
        ) : (
          <button
            key={d.id}
            className={`rail-btn${tool === d.id ? ' on' : ''}`}
            title={`${t(d.label)} (${d.key})`}
            aria-label={t(d.label)}
            aria-pressed={tool === d.id}
            onClick={() => setTool(d.id)}
          >
            <Icon name={d.icon} size={18} />
          </button>
        ),
      )}
      <button className="rail-btn" title={`${t('toolImage')} (I)`} aria-label={t('toolImage')} onClick={insertImage}>
        <Icon name="image" size={18} />
      </button>
      <span className="rail-sep" />
      <button
        className={`rail-btn${panelOpen && panelTab === 'shapes' ? ' on-soft' : ''}`}
        title={t('shapesSymbols')}
        aria-label={t('shapesSymbols')}
        onClick={() => {
          ui.set({ panelOpen: true, panelTab: 'shapes' });
          persist('quillon:panel', 'open');
          persist('quillon:panel-tab', 'shapes');
        }}
      >
        <Icon name="symbol" size={18} />
      </button>
      <span className="spacer" />
      <button className={`rail-btn${panelOpen ? ' on-soft' : ''}`} title={`${t('insertPanel')} (Ctrl+\\)`} aria-label={t('insertPanel')} onClick={togglePanel}>
        <Icon name="panel" size={18} />
      </button>
    </nav>
  );
}
