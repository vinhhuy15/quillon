import { addMath, fileOpen } from '../actions';
import { useT } from '../i18n';
import { persist, ui } from '../state/store';
import { setTool } from '../tools';
import { Icon, type IconName } from './Icons';
import { LOGO } from './TopBar';

/** Start card shown on an empty page. */
export function Welcome() {
  const t = useT();
  const actions: { icon: IconName; title: string; hint: string; kbd?: string; run: () => void }[] = [
    { icon: 'math', title: t('wEquation'), hint: t('wEquationHint'), kbd: 'M', run: () => addMath('') },
    {
      icon: 'shapes',
      title: t('wDiagram'),
      hint: t('wDiagramHint'),
      kbd: 'R',
      run: () => {
        ui.set({ panelOpen: true, panelTab: 'shapes' });
        persist('quillon:panel', 'open');
        setTool('shape:rect');
      },
    },
    { icon: 'plot', title: t('wPlot'), hint: t('wPlotHint'), kbd: 'P', run: () => setTool('plot') },
    { icon: 'template', title: t('wOpen'), hint: t('wOpenHint'), kbd: 'Ctrl+O', run: fileOpen },
  ];
  return (
    <div className="welcome">
      <div className="welcome-card" role="region" aria-label={t('wTitle')}>
        <div className="welcome-head">
          <img src={LOGO} alt="" />
          <div>
            <h1>{t('wTitle')}</h1>
            <p>{t('wSubtitle')}</p>
          </div>
        </div>
        <div className="welcome-grid">
          {actions.map((a) => (
            <button key={a.title} className="welcome-action" onClick={a.run}>
              <span className="wa-icon">
                <Icon name={a.icon} size={18} />
              </span>
              <span>
                <b>{a.title}</b>
                <small>{a.hint}</small>
              </span>
              {a.kbd && <kbd>{a.kbd}</kbd>}
            </button>
          ))}
        </div>
        <div className="welcome-foot">
          <span>{t('wTip')}</span>
          <button className="link-btn" onClick={() => ui.set({ aboutOpen: true })}>
            {t('shortcuts')}
          </button>
        </div>
      </div>
    </div>
  );
}
