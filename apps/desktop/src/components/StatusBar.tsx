import { zoomAt, zoomFit, zoomReset } from '../actions';
import { useT } from '../i18n';
import { isDesktop } from '../platform';
import { persist, ui, useEditor, useUi } from '../state/store';
import { toolHint } from '../tools';
import { Icon } from './Icons';

export function StatusBar() {
  const t = useT();
  const { doc, selection } = useEditor();
  const zoom = useUi((s) => s.zoom);
  const tool = useUi((s) => s.tool);
  const snap = useUi((s) => s.snap);
  return (
    <footer className="statusbar">
      <span className="status-hint">{t(toolHint(tool))}</span>
      <span className="spacer" />
      <span>
        {doc.nodes.length} {t('objects')}
        {selection.length > 0 && ` · ${selection.length} ${t('selected')}`}
      </span>
      <button
        className={`status-btn${snap ? ' on' : ''}`}
        title={t('snapToGrid')}
        onClick={() => {
          ui.set({ snap: !snap });
          persist('sciforge:snap', snap ? 'off' : 'on');
        }}
      >
        <Icon name="grid" size={14} />
        {t('snap')}
      </button>
      <span className="zoom-ctl">
        <button className="status-btn" title={`${t('zoomOut')} (Ctrl+−)`} onClick={() => zoomAt(1 / 1.2)}>
          <Icon name="minus" size={14} />
        </button>
        <button className="status-btn zoom-val" title={`${t('zoomReset')} (Ctrl+1)`} onClick={zoomReset}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="status-btn" title={`${t('zoomIn')} (Ctrl+=)`} onClick={() => zoomAt(1.2)}>
          <Icon name="plus" size={14} />
        </button>
        <button className="status-btn" title={`${t('zoomFit')} (Ctrl+0)`} onClick={zoomFit}>
          <Icon name="fit" size={14} />
        </button>
      </span>
      <span className="muted">{isDesktop ? 'Desktop' : 'Web'} · v0.2.0</span>
    </footer>
  );
}
