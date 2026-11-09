/** Compact form controls for the inspector. */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { editor } from '../state/store';
import { Icon, type IconName } from './Icons';

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="insp-section">
      <header>
        <h3>{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Row({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="insp-row">
      <label htmlFor={htmlFor}>{label}</label>
      <div className="insp-ctl">{children}</div>
    </div>
  );
}

/** Seal the undo group when a field gains or loses focus, so each edit session is one step. */
const sealProps = { onFocus: () => editor.seal(), onBlur: () => editor.seal() };

export function NumberField({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  label,
  id,
}: {
  value: number | null;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  label?: string;
  id?: string;
}) {
  const shown = value === null ? '' : String(Math.round(value * 1000) / 1000);
  const [text, setText] = useState(shown);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(shown);
  }, [shown]);
  const commit = (s: string) => {
    const v = parseFloat(s.replace(',', '.').replace('−', '-'));
    if (!Number.isFinite(v)) return;
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
  };
  return (
    <span className="num-field">
      {label && <span className="num-label">{label}</span>}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={value === null ? '—' : undefined}
        onFocus={() => {
          focused.current = true;
          editor.seal();
        }}
        onBlur={() => {
          focused.current = false;
          editor.seal();
          setText(shown);
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const base = parseFloat(text) || 0;
            const next = Math.round((base + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)) * 1000) / 1000;
            setText(String(next));
            commit(String(next));
          } else if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {suffix && <span className="num-suffix">{suffix}</span>}
    </span>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  mono,
  inputRef,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
  inputRef?: React.Ref<HTMLInputElement & HTMLTextAreaElement>;
  invalid?: boolean;
}) {
  const common = {
    ...sealProps,
    className: `text-field${mono ? ' mono' : ''}${invalid ? ' invalid' : ''}`,
    value,
    placeholder,
    spellCheck: false,
    onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
    ref: inputRef,
  };
  return multiline ? (
    <textarea {...common} rows={2} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input {...common} type="text" onChange={(e) => onChange(e.target.value)} />
  );
}

export interface SegOption<T extends string> {
  value: T;
  label?: string;
  icon?: IconName;
  node?: ReactNode;
  title: string;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T | null; options: SegOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          title={o.title}
          onClick={() => {
            editor.seal();
            onChange(o.value);
          }}
        >
          {o.icon ? <Icon name={o.icon} /> : o.node ?? o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean | null; onChange: (v: boolean) => void; label: string }) {
  const id = useId();
  return (
    <label className="check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={!!checked}
        ref={(el) => {
          if (el) el.indeterminate = checked === null;
        }}
        onChange={(e) => {
          editor.seal();
          onChange(e.target.checked);
        }}
      />
      {label}
    </label>
  );
}

export function Select<T extends string>({ value, options, onChange, id }: { value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void; id?: string }) {
  return (
    <select
      id={id}
      className="select"
      value={value ?? ''}
      onChange={(e) => {
        editor.seal();
        onChange(e.target.value as T);
      }}
    >
      {value === null && <option value="">—</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Colors chosen for figures that print well and stay distinct (Okabe–Ito based, plus neutrals). */
export const SWATCHES = [
  '#1f2937', '#6b7280', '#d1d5db', '#ffffff',
  '#0072b2', '#56b4e9', '#009e73', '#e69f00',
  '#d55e00', '#cc79a7', '#f0e442', '#b91c1c',
];

export function ColorField({ value, onChange, allowNone, noneLabel }: { value: string | null; onChange: (v: string) => void; allowNone?: boolean; noneLabel?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  const none = value === 'none';
  const hex = value && !none && /^#[0-9a-f]{6}$/i.test(value) ? value : '#1f2937';
  return (
    <div className="color-field" ref={ref}>
      <button
        className={`swatch-btn${none ? ' none' : ''}`}
        onClick={() => {
          editor.seal();
          setOpen(!open);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="swatch" style={none || value === null ? undefined : { background: value }}>
          {none && <Icon name="none" size={14} />}
        </span>
        <span className="swatch-text">{value === null ? '—' : none ? noneLabel ?? 'None' : value.toUpperCase()}</span>
      </button>
      {open && (
        <div className="color-pop" role="dialog">
          <div className="swatch-grid">
            {allowNone && (
              <button className="swatch none" title={noneLabel ?? 'None'} onClick={() => (onChange('none'), setOpen(false))}>
                <Icon name="none" size={14} />
              </button>
            )}
            {SWATCHES.map((c) => (
              <button key={c} className={`swatch${c === value ? ' on' : ''}`} style={{ background: c }} title={c} onClick={() => (onChange(c), setOpen(false))} />
            ))}
          </div>
          <label className="custom-color">
            <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} />
            <span>{hex.toUpperCase()}</span>
          </label>
        </div>
      )}
    </div>
  );
}

export function IconButton({ icon, title, onClick, disabled, on }: { icon: IconName; title: string; onClick: () => void; disabled?: boolean; on?: boolean }) {
  return (
    <button className={`icon-btn${on ? ' on' : ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
    </button>
  );
}
