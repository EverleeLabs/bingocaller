import { useState } from 'react';
import { useEvents, updateEvent, newGame, newBreak } from '../lib/store.js';
import { PRESETS, variantsFor, activeColumns, previewCells, patternName, patternIdsOf, togglePatternId, selectedPatterns, callPool, COLUMN_PICK, columnPickOf, columnPickVariants, columnPickName, LETTERS, FREE } from '../lib/patterns.js';
import { PatternGrid, CyclingPattern, ColumnChips } from '../components/Bingo.jsx';
import { navigate } from '../App.jsx';

export default function EventEditor({ id }) {
  const event = useEvents().find((e) => e.id === id);
  const [open, setOpen] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  if (!event) return <Missing />;

  const set = (patch) => updateEvent(id, patch);
  const setItems = (fn) => updateEvent(id, (e) => ({ items: fn(e.items) }));
  const patchItem = (itemId, patch) => setItems((items) => items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
  const move = (from, to) =>
    setItems((items) => {
      if (to < 0 || to >= items.length) return items;
      const next = [...items];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  const addGame = () => {
    const g = newGame(event.items.filter((i) => i.type === 'game').length + 1);
    setItems((items) => [...items, g]);
    setOpen(g.id);
  };
  const addBreak = () => {
    const b = newBreak();
    setItems((items) => [...items, b]);
    setOpen(b.id);
  };
  const remove = (itemId) => setItems((items) => items.filter((i) => i.id !== itemId));

  let gameNo = 0;

  return (
    <main className="page page--narrow">
      <nav className="crumbs">
        <a href="#/">All events</a>
      </nav>

      <header className="editor-head">
        <label className="field field--title">
          <span className="field__label">Event name</span>
          <input value={event.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field field--short">
          <span className="field__label">Seconds between calls</span>
          <NumberInput min={2} max={60} value={event.interval} onCommit={(n) => set({ interval: n })} />
        </label>
        <button className="btn btn--primary" onClick={() => navigate(`/run/${id}`)} disabled={!event.items.length}>
          Run event
        </button>
      </header>

      <section className="stack">
        <div className="row row--between">
          <h2>Running order</h2>
          <p className="muted">Drag to reorder, or use the arrows.</p>
        </div>

        {event.items.length === 0 && (
          <div className="empty">
            <p>Add the games you'll play tonight, in order. Put intermissions between them wherever you need a break.</p>
          </div>
        )}

        <ol className="items">
          {event.items.map((item, idx) => {
            const isGame = item.type === 'game';
            if (isGame) gameNo++;
            const isOpen = open === item.id;
            const variants = isGame ? variantsFor(item) : [];
            const cols = activeColumns(variants);
            return (
              <li
                key={item.id}
                className={`item item--${item.type}${isOpen ? ' is-open' : ''}${dragIndex === idx ? ' is-dragging' : ''}`}
                draggable
                onDragStart={(e) => {
                  setDragIndex(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== idx) move(dragIndex, idx);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <div className="item__bar">
                  <span className="item__grip" aria-hidden>⠿</span>
                  <span className="item__pos">{idx + 1}</span>
                  {isGame ? (
                    <PatternGrid
                      marked={new Set(selectedPatterns(item).flatMap((p) => p.variants[0] || []))}
                      alt={previewCells(variants)}
                      size="xs"
                      label={patternName(item)}
                    />
                  ) : (
                    <span className="item__clock" aria-hidden>{item.minutes}′</span>
                  )}
                  <button className="item__summary" onClick={() => setOpen(isOpen ? null : item.id)} aria-expanded={isOpen}>
                    <strong>{item.name || (isGame ? `Game ${gameNo}` : 'Intermission')}</strong>
                    <span className="muted">
                      {isGame
                        ? `${patternName(item)}${item.callLimit?.enabled ? `, ${item.callLimit.count} numbers` : ''}`
                        : `${item.minutes} minute break`}
                    </span>
                  </button>
                  {isGame && <ColumnChips activeCols={cols} />}
                  <span className="item__tools">
                    <button className="icon-btn" onClick={() => move(idx, idx - 1)} disabled={idx === 0} aria-label="Move up">↑</button>
                    <button className="icon-btn" onClick={() => move(idx, idx + 1)} disabled={idx === event.items.length - 1} aria-label="Move down">↓</button>
                    <button className="icon-btn" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`}>✕</button>
                  </span>
                </div>

                {isOpen && (isGame ? (
                  <GameEditor item={item} event={event} onChange={(p) => patchItem(item.id, p)} />
                ) : (
                  <BreakEditor item={item} onChange={(p) => patchItem(item.id, p)} />
                ))}
              </li>
            );
          })}
        </ol>

        <div className="row">
          <button className="btn" onClick={addGame}>Add game</button>
          <button className="btn" onClick={addBreak}>Add intermission</button>
        </div>
      </section>
    </main>
  );
}

function GameEditor({ item, event, onChange }) {
  const variants = variantsFor(item);
  const cols = activeColumns(variants);
  const skipped = LETTERS.filter((_, c) => !cols.includes(c));
  const ids = patternIdsOf(item);
  const [hovered, setHovered] = useState(null);
  const toggle = (id) => onChange({ patternIds: togglePatternId(item, id), patternId: undefined });

  return (
    <div className="item__body">
      <div className="grid-2">
        <label className="field">
          <span className="field__label">Game name</span>
          <input value={item.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="field field--short">
          <span className="field__label">Seconds between calls</span>
          <NumberInput
            min={2}
            max={60}
            allowEmpty
            placeholder={`${event.interval} (event default)`}
            value={item.interval}
            onCommit={(n) => onChange({ interval: n })}
          />
        </label>
      </div>

      <CallLimit item={item} poolSize={callPool(variants).length} onChange={onChange} />

      <fieldset className="field">
        <legend className="field__label">Ways to win</legend>
        <p className="muted">
          Pick one or more. A card wins by completing any one of them.
          {ids.length > 1 && ` ${ids.length} picked: ${patternName(item)}.`}
        </p>
        <div className="patterns">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pattern-pick${ids.includes(p.id) ? ' is-picked' : ''}`}
              aria-pressed={ids.includes(p.id)}
              onClick={() => toggle(p.id)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(p.id)}
              onBlur={() => setHovered(null)}
            >
              <CyclingPattern variants={p.variants} play={hovered === p.id} size="sm" />
              <span className="pattern-pick__name">{p.name}</span>
              <span className="pattern-pick__blurb">{p.blurb}</span>
              {p.variants.length > 1 && <span className="pattern-pick__ways">{p.variants.length} ways to win</span>}
            </button>
          ))}
          <ColumnPickTile item={item} picked={ids.includes(COLUMN_PICK)} onToggle={() => toggle(COLUMN_PICK)} />
          <button
            type="button"
            className={`pattern-pick${ids.includes('custom') ? ' is-picked' : ''}`}
            aria-pressed={ids.includes('custom')}
            onClick={() => toggle('custom')}
          >
            <PatternGrid marked={previewCells(item.custom || [])} size="sm" />
            <span className="pattern-pick__name">Draw your own</span>
            <span className="pattern-pick__blurb">Any shape, one or more ways</span>
          </button>
        </div>
      </fieldset>

      {ids.includes(COLUMN_PICK) && <ColumnPickSettings item={item} onChange={onChange} />}
      {ids.includes('custom') && <CustomPattern item={item} onChange={onChange} />}

      <p className="callout">
        {skipped.length === 0
          ? 'Every column can help win this game, so all 75 numbers can be called.'
          : `${skipped.length > 1 ? `${skipped.slice(0, -1).join(', ')} and ${skipped[skipped.length - 1]}` : skipped[0]} can't help anyone win this game, so ${skipped.length === 1 ? 'that column is' : 'those columns are'} never called. ${cols.length * 15} numbers are in play.`}
      </p>
    </div>
  );
}

function CallLimit({ item, poolSize, onChange }) {
  const on = !!item.callLimit?.enabled;
  const count = item.callLimit?.count ?? Math.min(40, poolSize);
  const set = (patch) => onChange({ callLimit: { enabled: on, count, ...patch } });
  return (
    <div className={`limit${on ? ' is-on' : ''}`}>
      <label className="switch">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => set({ enabled: e.target.checked })} />
        <span className="switch__track" aria-hidden />
        <span>Limit how many numbers are called</span>
      </label>
      {on && (
        <div className="limit__body">
          <label className="field field--short">
            <span className="field__label">Numbers to call</span>
            <NumberInput min={1} max={75} value={count} onCommit={(n) => set({ count: n })} />
          </label>
          <p className="muted">
            Calling stops after {Math.min(count, poolSize)} {Math.min(count, poolSize) === 1 ? 'number' : 'numbers'}. During the game you can add more
            to keep going. This game has {poolSize} numbers in play
            {count > poolSize ? `, so it will stop at ${poolSize}` : ''}.
          </p>
        </div>
      )}
    </div>
  );
}

function ColumnPickTile({ item, picked, onToggle }) {
  const [hover, setHover] = useState(false);
  const cp = columnPickOf(item);
  const variants = columnPickVariants(cp);
  return (
    <button
      type="button"
      className={`pattern-pick${picked ? ' is-picked' : ''}`}
      aria-pressed={picked}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <CyclingPattern variants={variants} play={hover} size="sm" />
      <span className="pattern-pick__name">Any 2 in two columns</span>
      <span className="pattern-pick__blurb">{columnPickName(cp)}</span>
    </button>
  );
}

function ColumnPickSettings({ item, onChange }) {
  const { cols } = columnPickOf(item);
  const [first, second] = cols;
  const setCols = (a, b) => onChange({ colPick: { cols: [a, b] } });
  const others = selectedPatterns(item).filter((p) => p.id !== COLUMN_PICK);
  return (
    <div className="colpick">
      <ColumnSelect label="First column" value={first} exclude={second} onChange={(c) => setCols(c, second)} />
      <span className="colpick__and">and</span>
      <ColumnSelect label="Second column" value={second} exclude={first} onChange={(c) => setCols(first, c)} />
      <p className="colpick__hint">
        A card wins only with any 2 squares covered in {LETTERS[first]} <strong>and</strong> any 2 covered in {LETTERS[second]}.
        Only {LETTERS[first]} and {LETTERS[second]} numbers are called.
        {(first === 2 || second === 2) && ' The free space counts as one of the N squares.'}
      </p>
      {others.length > 0 && (
        <p className="warn colpick__hint">
          This game also accepts {others.map((o) => o.name).join(', ')}, so {others.length === 1 ? 'that wins' : 'those win'} too. Click{' '}
          {others.length === 1 ? 'that pattern' : 'those patterns'} above to turn {others.length === 1 ? 'it' : 'them'} off if only
          “{columnPickName({ cols, count: 2 })}” should win.
        </p>
      )}
    </div>
  );
}

function ColumnSelect({ label, value, exclude, onChange }) {
  return (
    <fieldset className="field">
      <legend className="field__label">{label}</legend>
      <div className="colpick__cols">
        {LETTERS.map((l, c) => (
          <button
            key={l}
            type="button"
            className={`colpick__col col-${c}${value === c ? ' is-on' : ''}`}
            aria-pressed={value === c}
            disabled={c === exclude}
            onClick={() => onChange(c)}
          >
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CustomPattern({ item, onChange }) {
  const custom = item.custom?.length ? item.custom : [[]];
  const setVariant = (vi, cells) => onChange({ custom: custom.map((v, i) => (i === vi ? cells : v)) });
  return (
    <div className="custom">
      <label className="field">
        <span className="field__label">Pattern name</span>
        <input value={item.customName} placeholder="Custom pattern" onChange={(e) => onChange({ customName: e.target.value })} />
      </label>
      <p className="muted">
        Tap squares to build the shape. Add another way if more than one shape should win. The free space counts as covered.
      </p>
      <div className="custom__grids">
        {custom.map((v, vi) => (
          <div key={vi} className="custom__grid">
            <PatternGrid
              marked={new Set(v)}
              size="lg"
              label={`Way ${vi + 1}`}
              onToggle={(cell) => setVariant(vi, v.includes(cell) ? v.filter((c) => c !== cell) : [...v, cell].sort((a, b) => a - b))}
            />
            <div className="row">
              <span className="muted">Way {vi + 1}</span>
              {custom.length > 1 && (
                <button className="btn btn--quiet" onClick={() => onChange({ custom: custom.filter((_, i) => i !== vi) })}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button className="btn" onClick={() => onChange({ custom: [...custom, []] })}>Add another way to win</button>
      {custom.every((v) => v.filter((c) => c !== FREE).length === 0) && (
        <p className="warn">Mark at least one square, or no numbers can be called for this game.</p>
      )}
    </div>
  );
}

function BreakEditor({ item, onChange }) {
  return (
    <div className="item__body">
      <div className="grid-2">
        <label className="field">
          <span className="field__label">Name</span>
          <input value={item.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="field field--short">
          <span className="field__label">Length in minutes</span>
          <NumberInput min={1} max={120} value={item.minutes} onCommit={(n) => onChange({ minutes: n })} />
        </label>
      </div>
      <label className="field">
        <span className="field__label">Message on the TV (optional)</span>
        <input value={item.message} placeholder="Snacks and drinks are in the back" onChange={(e) => onChange({ message: e.target.value })} />
      </label>
    </div>
  );
}

function Missing() {
  return (
    <main className="page page--narrow">
      <div className="empty">
        <p>This event isn't saved in this browser.</p>
        <a className="btn" href="#/">Go to your events</a>
      </div>
    </main>
  );
}

/**
 * A number box you can type into freely. While typing, valid numbers are saved
 * as you go; when you leave the box, an out-of-range entry is pulled into
 * range and an empty one is cleared (allowEmpty) or goes back to what it was.
 */
function NumberInput({ value, min, max, onCommit, allowEmpty = false, placeholder }) {
  const [draft, setDraft] = useState(null); // text while editing, null otherwise
  const [before, setBefore] = useState(value); // value when editing started
  const shown = draft ?? (value ?? '');
  const inRange = (n) => Number.isInteger(n) && n >= min && n <= max;

  const onChange = (e) => {
    const text = e.target.value;
    setDraft(text);
    const n = parseInt(text, 10);
    if (text === '' && allowEmpty) onCommit(null);
    else if (inRange(n) && String(n) === text.trim()) onCommit(n);
  };

  const finish = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (draft.trim() === '') {
      // Left empty: clear it if that's allowed, otherwise put the old number back.
      onCommit(allowEmpty ? null : before);
    } else if (!Number.isNaN(n)) {
      onCommit(Math.min(max, Math.max(min, n)));
    }
    setDraft(null);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      placeholder={placeholder}
      value={shown}
      onChange={onChange}
      onFocus={() => setBefore(value)}
      onBlur={finish}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}
