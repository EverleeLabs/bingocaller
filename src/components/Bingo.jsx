import { useEffect, useState } from 'react';
import { FREE, LETTERS, letterOf, columnOf } from '../lib/patterns.js';
import { DEFAULT_THEME } from '../lib/theme.js';

/**
 * 5x5 card. `marked` = Set of cell indexes. `alt` = Set of squares used by
 * other winning shapes (drawn faintly). Pass onToggle to make it drawable.
 */
export function PatternGrid({ marked, alt, onToggle, size = 'md', label }) {
  return (
    <div className={`pgrid pgrid--${size}`} role={onToggle ? 'group' : 'img'} aria-label={label}>
      {LETTERS.map((l, c) => (
        <span key={l} className={`pgrid__head col-${c}`} aria-hidden>{l}</span>
      ))}
      {Array.from({ length: 25 }, (_, i) => {
        const on = marked.has(i);
        const free = i === FREE;
        const faint = !on && alt?.has(i);
        const cls = `pgrid__cell${on ? ' is-on' : ''}${faint ? ' is-alt' : ''}${free ? ' is-free' : ''}`;
        if (!onToggle) return <span key={i} className={cls} />;
        return (
          <button
            key={i}
            type="button"
            className={cls}
            aria-pressed={on}
            aria-label={`${LETTERS[i % 5]} row ${Math.floor(i / 5) + 1}${free ? ' (free space)' : ''}`}
            onClick={() => onToggle(i)}
          />
        );
      })}
    </div>
  );
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A pattern with several winning shapes (e.g. "Two lines down") steps through
 * them one at a time; squares from the other shapes stay faintly visible.
 * `play` turns the stepping on (continuous on the TV, on hover in the editor).
 */
export function CyclingPattern({ variants, play = true, size = 'md', label }) {
  const [step, setStep] = useState(0);
  const many = variants.length > 1;
  useEffect(() => {
    if (!play || !many || reducedMotion()) {
      setStep(0);
      return;
    }
    const t = setInterval(() => setStep((s) => s + 1), 1100);
    return () => clearInterval(t);
  }, [play, many, variants.length]);
  const current = new Set(variants[step % Math.max(1, variants.length)] || []);
  const alt = many ? new Set(variants.flat()) : undefined;
  return <PatternGrid marked={current} alt={alt} size={size} label={label} />;
}

/** The 75-number board. Columns not in play are shown as out of play. */
export function Board({ called, activeCols, latest, size = 'md' }) {
  const calledSet = new Set(called);
  const active = new Set(activeCols);
  return (
    <div className={`board board--${size}`}>
      {LETTERS.map((l, c) => (
        <div key={l} className={`board__row col-${c}${active.has(c) ? '' : ' is-out'}`}>
          <span className="board__letter">{l}</span>
          {Array.from({ length: 15 }, (_, k) => {
            const n = c * 15 + k + 1;
            const hit = calledSet.has(n);
            return (
              <span key={n} className={`board__num${hit ? ' is-called' : ''}${n === latest ? ' is-latest' : ''}`}>
                {n}
              </span>
            );
          })}
          {!active.has(c) && <span className="board__out">Not called this game</span>}
        </div>
      ))}
    </div>
  );
}

export function Ball({ n, size = 'md' }) {
  if (!n) return <div className={`ball ball--${size} ball--empty`} aria-label="No number yet" />;
  return (
    <div className={`ball ball--${size} col-${columnOf(n)}`} aria-label={`${letterOf(n)} ${n}`}>
      <span className="ball__face">
        <span className="ball__letter">{letterOf(n)}</span>
        <span className="ball__num">{n}</span>
      </span>
    </div>
  );
}

export function ColumnChips({ activeCols }) {
  const active = new Set(activeCols);
  return (
    <span className="chips" aria-label={`Calls ${activeCols.map((c) => LETTERS[c]).join(', ')}`}>
      {LETTERS.map((l, c) => (
        <span key={l} className={`chip col-${c}${active.has(c) ? '' : ' is-out'}`} title={active.has(c) ? `${l} is called` : `${l} is skipped`}>
          {l}
        </span>
      ))}
    </span>
  );
}

export const fmtClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** One small card per way to win, each with its name. `patterns` = [{ name, variants }] */
export function PatternSet({ patterns, size = 'md' }) {
  return (
    <ul className={`pset pset--${size} pset--n${Math.min(patterns.length, 5)}`}>
      {patterns.map((p) => (
        <li key={p.name} className="pset__item">
          <CyclingPattern variants={p.variants || [p.cells || []]} size="lg" label={p.name} />
          <span className="pset__name">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}

/** The logo and/or event name, as the TV shows them. */
export function Brand({ logo, theme, eventName, className = '' }) {
  const place = theme?.logoPlace || DEFAULT_THEME.logoPlace;
  const size = theme?.logoSize || DEFAULT_THEME.logoSize;
  return (
    <div className={`brand brand--${size}${logo && place === 'instead' ? ' brand--only' : ''} ${className}`}>
      {logo && <img className="brand__logo" src={logo} alt={place === 'instead' ? eventName : ''} />}
      {!(logo && place === 'instead') && <span className="tv__event">{eventName}</span>}
    </div>
  );
}
