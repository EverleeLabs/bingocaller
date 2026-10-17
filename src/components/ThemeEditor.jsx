import { useEffect, useRef, useState } from 'react';
import { updateEvent, uid } from '../lib/store.js';
import {
  DEFAULT_THEME, FONTS, LOGO_PLACES, LOGO_SIZE, BUILT_IN_SETS, isCornerPlace,
  cleanTheme, themeStyle, themeWarnings, shrinkImage, shrinkLogo, cropLogo, trimBounds,
} from '../lib/theme.js';
import { usePictures, putPictures } from '../lib/pictures.js';
import LogoCropper from './LogoCropper.jsx';
import { suggestThemes, analysePicture } from '../lib/suggest.js';
import { useSavedSets, saveSet, deleteSet } from '../lib/palettes.js';
import { LETTERS } from '../lib/patterns.js';
import { Ball, Brand, CornerLogo } from './Bingo.jsx';

const OUT_OF_ROOM = 'This browser is out of room to save that picture. Try a smaller picture.';
const RESET = 'Back to the standard colour';
const LOGO_KEYS = ['logo', 'logoSource', 'logoCrop', 'logoPlace', 'logoSize'];

/**
 * The event's colours, pictures and font, used on every screen of the event
 * (TV and caller). Anything not changed uses the standard look.
 */
export default function ThemeEditor({ event }) {
  const theme = event.theme || {};
  const pictures = usePictures(theme);
  const custom = Object.keys(theme).length > 0;
  const [error, setError] = useState('');
  const [open, setOpen] = useState(custom);
  const [cropping, setCropping] = useState(null); // { src, crop, sourceId } while the crop dialog is open
  const [undo, setUndo] = useState(null); // the theme before the last suggestion or fix
  const stats = usePictureStats(pictures.image);

  /** Change the event's theme. `fn` gets the latest saved theme so quick changes don't overwrite each other. */
  const write = (fn) => updateEvent(event.id, (e) => ({ theme: cleanTheme(fn(e.theme || {})) }));
  const setKey = (key, value) => write((t) => ({ ...t, [key]: value }));
  const setBall = (c, key, value) =>
    write((t) => ({ ...t, balls: Array.from({ length: 5 }, (_, k) => (k === c ? { ...t.balls?.[k], [key]: value } : { ...t.balls?.[k] })) }));

  const addPicture = async (kind, file) => {
    setError('');
    try {
      if (kind === 'logo') {
        // A new logo goes through the crop dialog first, already trimmed to its edges.
        const src = await shrinkLogo(file);
        setCropping({ src, crop: await trimBounds(src), sourceId: null });
        return;
      }
      const data = await shrinkImage(file, theme.bg || DEFAULT_THEME.bg);
      const id = uid();
      if (!(await putPictures({ [id]: data }))) {
        setError(OUT_OF_ROOM);
        return;
      }
      if (!write((t) => ({ ...t, [kind]: id }))) {
        write((t) => ({ ...t, [kind]: null }));
        setError(OUT_OF_ROOM);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  /** Re-crop the current logo, starting from the original upload when there is one. */
  const editCrop = () => {
    const fromSource = Boolean(pictures.logoSource);
    setCropping({
      src: fromSource ? pictures.logoSource : pictures.logo,
      crop: fromSource ? theme.logoCrop : undefined,
      sourceId: fromSource ? theme.logoSource : theme.logo,
    });
  };
  const saveCrop = async (rect) => {
    setError('');
    const { src, sourceId } = cropping;
    const cropped = await cropLogo(src, rect);
    const logoId = uid();
    const srcId = sourceId || uid();
    let ok = (await putPictures({ [logoId]: cropped, ...(sourceId ? {} : { [srcId]: src }) })) &&
      write((t) => ({ ...t, logo: logoId, logoSource: srcId, logoCrop: rect }));
    if (!ok) ok = (await putPictures({ [logoId]: cropped })) && write((t) => ({ ...t, logo: logoId, logoSource: null, logoCrop: null })); // no room for the original
    if (!ok) {
      write(() => theme);
      setError(OUT_OF_ROOM);
    }
    setCropping(null);
  };

  /** Use a colour set. The event's logo stays unless the set has its own. */
  const applySet = (set) => {
    if (custom && !confirm(`Replace this event's colours with “${set.name}”?`)) return;
    setError('');
    const t = set.theme; // its picture and logo are shared with the set, by id
    const keepLogo = (cur) => Object.fromEntries(LOGO_KEYS.map((k) => [k, cur[k]]));
    const ok = write((cur) => ({ ...t, ...(t.logo ? {} : keepLogo(cur)) }));
    if (!ok) {
      write(() => theme);
      setError(OUT_OF_ROOM);
    }
  };

  const warnings = themeWarnings(theme, stats);
  const suggestions = theme.bg || (pictures.image && stats) ? suggestThemes(theme, stats) : [];
  /** Apply a suggestion or a fix, remembering the theme before so it can be undone. */
  const applyPatch = (patch) => {
    setUndo(theme);
    write((t) => ({ ...t, ...patch }));
  };
  const color = (label, key) => (
    <ColorField label={label} value={theme[key]} fallback={DEFAULT_THEME[key]} onChange={(v) => setKey(key, v)} />
  );

  return (
    <details className="theme theme--event" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="theme__summary">
        <span>Colours, logo and font</span>
        <span className="muted">
          {custom ? 'Custom look' : 'Standard look'}, used on the TV and the caller screen for every game, intermission and the end screen
        </span>
      </summary>

      <div className="theme__body">
        <div className="theme__side">
          <ThemePreview theme={theme} pictures={pictures} title={event.items.find((i) => i.type === 'game')?.name || 'Game 1'} eventName={event.name} />
          <ButtonPreview theme={theme} />
          <ColourSets onApply={applySet} />
        </div>

        <div className="theme__controls">
          <fieldset className="theme__group">
            <legend className="field__label">Background</legend>
            <div className="theme__row">{color('Colour', 'bg')}</div>
            <PictureField kind="image" label="picture" data={pictures.image} onAdd={(f) => addPicture('image', f)} onRemove={() => setKey('image', null)} />
            {pictures.image && (
              <RangeField
                label="Fade the picture"
                value={theme.dim ?? DEFAULT_THEME.dim}
                min={0}
                max={90}
                step={5}
                format={(n) => `${n}%`}
                onChange={(n) => setKey('dim', n)}
                hint="Tints the picture with the background colour so the board stays readable."
              />
            )}
          </fieldset>

          <fieldset className="theme__group">
            <legend className="field__label">Text and highlights</legend>
            <div className="theme__row">
              {color('All text', 'text')}
              {color('Pattern squares', 'accent')}
            </div>
          </fieldset>

          {suggestions.length > 0 && (
            <div className="suggest">
              <p className="field__label">Suggested colours for {pictures.image ? 'your picture' : 'this background'}</p>
              <div className="suggest__list">
                {suggestions.map((s) => (
                  <button key={s.id} type="button" className="suggest__pick" onClick={() => applyPatch(s.patch)} title="Sets the text, highlight, ball and button colours. Everything stays easy to read.">
                    <span className="suggest__swatch" style={{ background: s.patch.bg, color: s.patch.text }}>
                      Aa
                      {s.patch.balls.map((b, c) => (
                        <i key={c} style={{ background: b.bg }} />
                      ))}
                    </span>
                    {s.name}
                  </button>
                ))}
                {undo && (
                  <button type="button" className="btn btn--quiet" onClick={() => (write(() => undo), setUndo(null))}>
                    Undo
                  </button>
                )}
              </div>
            </div>
          )}

          <fieldset className="theme__group">
            <legend className="field__label">Balls and called numbers</legend>
            <div className="theme__balls">
              <span />
              {LETTERS.map((l) => (
                <span key={l} className="theme__letter" aria-hidden>{l}</span>
              ))}
              <span className="theme__rowlabel" aria-hidden>Ball</span>
              {LETTERS.map((l, c) => (
                <ColorField key={l} label={`${l} ball colour`} hideLabel value={theme.balls?.[c]?.bg} fallback={DEFAULT_THEME.balls[c].bg} onChange={(v) => setBall(c, 'bg', v)} />
              ))}
              <span className="theme__rowlabel" aria-hidden>Text on it</span>
              {LETTERS.map((l, c) => (
                <ColorField key={l} label={`${l} text on ball colour`} hideLabel value={theme.balls?.[c]?.text} fallback={DEFAULT_THEME.balls[c].text} onChange={(v) => setBall(c, 'text', v)} />
              ))}
            </div>
            <p className="muted">“Text on it” colours the called numbers on the board and the B I N G O letters.</p>
            <div className="theme__row">
              {color('Ball centre', 'face')}
              {color('Number on ball', 'faceText')}
            </div>
          </fieldset>

          <fieldset className="theme__group">
            <legend className="field__label">Caller buttons</legend>
            <div className="theme__row">
              {color('Main buttons', 'button')}
              {color('Bingo button', 'bingo')}
            </div>
            <p className="muted">Start, Pause, Resume and the other caller buttons, and the Bingo buttons. The Bingo colour is also used for the Bingo and prize banners on the TV. Text on the buttons is picked automatically so it stays readable.</p>
          </fieldset>

          <fieldset className="theme__group">
            <legend className="field__label">Font for the board and balls</legend>
            <div className="fonts">
              {Object.entries(FONTS).map(([key, f]) => {
                const on = (theme.font || 'standard') === key;
                return (
                  <button key={key} type="button" className={`fonts__pick${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setKey('font', key === 'standard' ? null : key)}>
                    <span className="fonts__sample" style={{ fontFamily: f.family }}>B 12</span>
                    <span className="fonts__name">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="theme__group">
            <legend className="field__label">Logo</legend>
            <PictureField
              kind="logo"
              label="logo"
              data={pictures.logo}
              onAdd={(f) => addPicture('logo', f)}
              onRemove={() => write((t) => ({ ...t, logo: null, logoSource: null, logoCrop: null }))}
              extra={pictures.logo && <button type="button" className="btn btn--quiet" onClick={editCrop}>Crop logo</button>}
            />
            {pictures.logo ? (
              <div className="theme__row theme__row--top">
                <Choice label="Where" options={LOGO_PLACES} value={theme.logoPlace || DEFAULT_THEME.logoPlace} onChange={(v) => setKey('logoPlace', v)} />
                <RangeField
                  label="Size"
                  min={LOGO_SIZE.min}
                  max={LOGO_SIZE.max}
                  step={1}
                  value={theme.logoSize ?? DEFAULT_THEME.logoSize}
                  format={(n) => `${n}% of the screen height`}
                  onChange={(n) => setKey('logoSize', n)}
                />
              </div>
            ) : (
              <p className="muted">Shown with the event name on the TV board, intermissions and the end screen, or in a corner. You can crop it after choosing it. A PNG with a see-through background looks best.</p>
            )}
            {cropping && <LogoCropper src={cropping.src} crop={cropping.crop} onCancel={() => setCropping(null)} onSave={saveCrop} />}
          </fieldset>

          {warnings.length > 0 ? (
            <div className="warn check" role="status">
              {warnings.map((w) => (
                <p key={w.message} className="check__item">
                  <span>{w.message}</span>
                  <button type="button" className="btn" onClick={() => applyPatch(w.fix.patch)}>{w.fix.label}</button>
                </p>
              ))}
            </div>
          ) : (
            custom && <p className="check--ok" role="status">✓ Everything is easy to read from across the room.</p>
          )}
          {error && <p className="warn" role="alert">{error}</p>}

          <SaveSet theme={theme} pictures={pictures} />

          {custom && (
            <div className="row">
              <button type="button" className="btn btn--quiet" onClick={() => confirm('Clear this event’s colours, logo and font and go back to the standard look?') && write(() => ({}))}>
                Back to the standard look
              </button>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

/** Ready-made and saved colour sets; clicking one applies it. */
function ColourSets({ onApply }) {
  const saved = useSavedSets();
  const sets = [...BUILT_IN_SETS, ...saved];
  return (
    <div className="sets">
      <p className="field__label">Colour sets</p>
      <ul className="sets__list">
        {sets.map((s) => {
          const t = s.theme;
          return (
            <li key={s.id} className="sets__item">
              <button type="button" className="sets__pick" onClick={() => onApply(s)} title={`Use ${s.name}`}>
                <span className="sets__swatch" style={{ background: t.bg || DEFAULT_THEME.bg }}>
                  {DEFAULT_THEME.balls.map((b, c) => (
                    <span key={c} style={{ background: t.balls?.[c]?.bg || b.bg }} />
                  ))}
                </span>
                <span className="sets__name">{s.name}</span>
              </button>
              {saved.includes(s) && (
                <button type="button" className="swatch__reset" aria-label={`Delete ${s.name}`} title="Delete this set" onClick={() => confirm(`Delete the colour set “${s.name}”?`) && deleteSet(s.id)}>
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SaveSet({ theme, pictures }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = saveSet(name, theme, pictures);
    setNote(ok ? `Saved “${name.trim()}”. It's in Colour sets for every event.` : 'This browser is out of room to save the set. Try removing a picture first.');
    if (ok) setName('');
  };
  return (
    <form className="theme__save" onSubmit={submit}>
      <label className="field">
        <span className="field__label">Save these colours as a set to reuse</span>
        <span className="row">
          <input value={name} onChange={(e) => (setName(e.target.value), setNote(''))} placeholder="e.g. Christmas" maxLength={60} />
          <button type="submit" className="btn" disabled={!name.trim()}>Save set</button>
        </span>
      </label>
      {note && <p className="muted" role="status">{note}</p>}
    </form>
  );
}

/** Add, change or remove a picture. */
function PictureField({ kind, label, data, onAdd, onRemove, extra }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    await onAdd(file);
    setBusy(false);
    if (ref.current) ref.current.value = '';
  };
  return (
    <div className="theme__row">
      {data && <img className={`theme__thumb theme__thumb--${kind}`} src={data} alt="" />}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files[0])} />
      <button type="button" className="btn btn--quiet" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? 'Adding…' : data ? `Change ${label}` : `Add a ${label}`}
      </button>
      {extra}
      {data && (
        <button type="button" className="btn btn--quiet" onClick={onRemove}>
          Remove {label}
        </button>
      )}
    </div>
  );
}

function Choice({ label, options, value, onChange }) {
  return (
    <label className="choice">
      <span className="field__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([k, text]) => (
          <option key={k} value={k}>{text}</option>
        ))}
      </select>
    </label>
  );
}

/** Look at the background picture (for suggestions and the readability check). */
function usePictureStats(image) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let live = true;
    setStats(null);
    if (image) analysePicture(image).then((s) => live && setStats(s)).catch(() => {});
    return () => {
      live = false;
    };
  }, [image]);
  return stats;
}

/** The caller's buttons in these colours. */
function ButtonPreview({ theme }) {
  return (
    <div className="btnprev themed-controls" style={themeStyle(theme)} aria-hidden>
      <span className="btnprev__label">Caller buttons</span>
      <span className="btn btn--primary">Resume calling</span>
      <span className="btn">Pause</span>
      <span className="btn btn--bingo">Bingo!</span>
    </div>
  );
}

/** A small mock of the TV board in these colours. */
function ThemePreview({ theme, pictures, title, eventName }) {
  return (
    <div
      className={`tvprev${pictures.image ? ' has-image' : ''}${pictures.logo && isCornerPlace(theme.logoPlace) ? ` tvprev--corner-${theme.logoPlace}` : ''}`}
      style={themeStyle(theme, pictures.image)}
      aria-label="Preview of the TV board"
      role="img"
    >
      <div className="tvprev__head">
        <strong>{title}</strong>
        <Brand logo={pictures.logo} theme={theme} eventName={eventName} className="tvprev__brand" />
      </div>
      <CornerLogo logo={pictures.logo} theme={theme} />
      <div className="tvprev__balls">
        {[7, 22, 41, 53, 69].map((n) => (
          <Ball key={n} n={n} size="sm" />
        ))}
      </div>
      <div className="tvprev__board">
        {LETTERS.map((l, c) => (
          <div key={l} className={`tvprev__row col-${c}`}>
            <span className="tvprev__letter">{l}</span>
            {Array.from({ length: 6 }, (_, k) => (
              <span key={k} className={`tvprev__num${(k + c) % 3 === 0 ? ' is-called' : ''}`}>{c * 15 + k + 1}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="tvprev__pattern" aria-hidden>
        {Array.from({ length: 5 }, (_, k) => (
          <span key={k} className={k % 2 === 0 ? 'is-on' : ''} />
        ))}
      </div>
    </div>
  );
}

/**
 * A colour picker. Saving is throttled while dragging so the event isn't
 * rewritten dozens of times a second. Reset clears it back to the standard colour.
 */
function ColorField({ label, value, fallback, onChange, hideLabel = false }) {
  const [draft, setDraft] = useState(null);
  const commit = useThrottled(onChange, 120);
  return (
    <span className={`swatch${value ? ' is-set' : ''}`}>
      <label className="swatch__pick">
        <input
          type="color"
          value={draft ?? value ?? fallback}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => setDraft(null)}
          aria-label={hideLabel ? label : undefined}
        />
        {!hideLabel && <span>{label}</span>}
      </label>
      {value && (
        <button type="button" className="swatch__reset" onClick={() => (setDraft(null), onChange(null))} aria-label={`${RESET}: ${label}`} title={RESET}>
          ↺
        </button>
      )}
    </span>
  );
}

function RangeField({ label, value, min, max, step, format, onChange, hint }) {
  const [draft, setDraft] = useState(null);
  const commit = useThrottled(onChange, 120);
  const shown = draft ?? value;
  return (
    <label className="field theme__range">
      <span className="field__label">
        {label}: {format(shown)}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => {
          const n = Number(e.target.value);
          setDraft(n);
          commit(n);
        }}
        onBlur={() => setDraft(null)}
      />
      {hint && <span className="muted">{hint}</span>}
    </label>
  );
}

/** Call fn at most every `ms`, always delivering the last value. */
function useThrottled(fn, ms) {
  const state = useRef({ last: 0, timer: null, value: undefined });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return (value) => {
    const s = state.current;
    s.value = value;
    clearTimeout(s.timer);
    const wait = s.last + ms - Date.now();
    const run = () => {
      s.last = Date.now();
      fnRef.current(s.value);
    };
    if (wait <= 0) run();
    else s.timer = setTimeout(run, wait);
  };
}
