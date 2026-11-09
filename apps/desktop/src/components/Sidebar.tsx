import { useState } from 'react';
import { insertTemplate } from '../actions';
import { useT } from '../i18n';
import { library, useLibrary } from '../state/library';
import { useUi } from '../state/store';
import { TEMPLATES } from '../templates-data';
import { MathIcon } from './MathIcon';

export function Sidebar() {
  const t = useT();
  const lang = useUi((s) => s.lang);
  const li = lang === 'vi' ? 0 : 1;
  const items = useLibrary();
  const [tab, setTab] = useState<'templates' | 'library'>('templates');
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const groups = TEMPLATES.map((g) => ({
    ...g,
    items: g.items.filter(
      (it) => !query || it.title.some((x) => x.toLowerCase().includes(query)) || it.latex.toLowerCase().includes(query),
    ),
  })).filter((g) => g.items.length);

  return (
    <aside className="sidebar">
      <div className="side-tabs">
        <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          {t('templates')}
        </button>
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>
          {t('myLibrary')} {items.length ? `(${items.length})` : ''}
        </button>
      </div>
      {tab === 'templates' ? (
        <>
          <input className="side-search" type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="side-scroll">
            {groups.map((g) => (
              <section key={g.id} className="tpl-group">
                <h3>{g.label[li]}</h3>
                <div className="tpl-grid">
                  {g.items.map((it) => (
                    <button key={it.latex} className="tpl-card" title={it.title[li]} onClick={() => insertTemplate(it.latex)}>
                      <MathIcon latex={it.latex} size={13} display maxWidth={230} />
                      <span>{it.title[li]}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="side-scroll">
          {items.length === 0 && <p className="muted pad">{t('libraryEmpty')}</p>}
          <div className="tpl-grid">
            {items.map((it) => (
              <div key={it.id} className="tpl-card lib">
                <button className="tpl-insert" title={it.latex} onClick={() => insertTemplate(it.latex)}>
                  <MathIcon latex={it.latex} size={13} display maxWidth={230} />
                </button>
                <button className="tpl-remove" title={t('remove')} onClick={() => library.remove(it.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
