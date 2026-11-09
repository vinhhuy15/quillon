import { useT } from '../i18n';
import { isDesktop } from '../platform';
import { useEditor, useUi } from '../state/store';

export function StatusBar() {
  const t = useT();
  const { doc, selection, fileName, dirty } = useEditor();
  const zoom = useUi((s) => s.zoom);
  return (
    <footer className="statusbar">
      <span>
        {fileName ?? t('untitled')}
        {dirty && <em> • {t('unsaved')}</em>}
      </span>
      <span>
        {doc.nodes.length} {t('objects')}
        {selection.length > 0 && ` · ${selection.length} ${t('selected')}`}
      </span>
      <span className="spacer" />
      <span>{Math.round(zoom * 100)}%</span>
      <span className="muted">{isDesktop ? 'Desktop' : 'Web'} · v0.1.0</span>
    </footer>
  );
}
