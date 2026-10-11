import { useEffect, useMemo, useRef, useState } from 'react';
import { useEvents } from '../lib/store.js';
import { variantsFor, activeColumns, callPool, patternName, selectedPatterns, LETTERS } from '../lib/patterns.js';
import { publishScreen, openDisplayWindow, useWorkerNow } from '../lib/sync.js';
import { Board, Ball, PatternSet, ColumnChips, fmtClock } from '../components/Bingo.jsx';
import { announceNumber, say, isSpeaking, unlockAudio, stopSpeaking, useAudioSettings } from '../lib/voice.js';
import AudioControls from '../components/AudioControls.jsx';
import TvHelp from '../components/TvHelp.jsx';

const RUN_KEY = 'bingo.run.v1';

// phase for a game: ready → calling ⇄ paused → bingo (checking a card) → over
// phase for an intermission: break
// index === items.length means the event is finished.

function freshState(event, index) {
  const item = event.items[index];
  if (!item) return { eventId: event.id, index, phase: 'end', called: [] };
  if (item.type === 'break') return { eventId: event.id, index, phase: 'break', called: [], endsAt: Date.now() + item.minutes * 60000 };
  return { eventId: event.id, index, phase: 'ready', called: [], interval: null, nextCallAt: null, remaining: null };
}

function loadRun(event) {
  try {
    const saved = JSON.parse(localStorage.getItem(RUN_KEY));
    if (saved?.eventId === event.id && saved.index <= event.items.length) {
      // Never resume auto-calling by surprise after a reload.
      return saved.phase === 'calling' ? { ...saved, phase: 'paused', remaining: null } : saved;
    }
  } catch {
    /* ignore */
  }
  return freshState(event, 0);
}

/** One card per selected pattern; cards with several shapes step through them. */
function patternsForScreen(game) {
  return selectedPatterns(game).map((p) => ({ name: p.name, variants: p.variants }));
}

function drawFrom(pool, called) {
  const calledSet = new Set(called);
  const left = pool.filter((n) => !calledSet.has(n));
  if (!left.length) return null;
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return left[r[0] % left.length];
}

export default function Caller({ id }) {
  const event = useEvents().find((e) => e.id === id);
  if (!event) {
    return (
      <main className="page page--narrow">
        <div className="empty">
          <p>This event isn't saved in this browser.</p>
          <a className="btn" href="#/">Go to your events</a>
        </div>
      </main>
    );
  }
  return <CallerInner event={event} />;
}

function CallerInner({ event }) {
  const [run, setRun] = useState(() => loadRun(event));
  const now = useWorkerNow(200);
  const audio = useAudioSettings();
  const item = event.items[run.index];
  const isGame = item?.type === 'game';
  const variants = useMemo(() => (isGame ? variantsFor(item) : []), [isGame, item]);
  const pool = useMemo(() => callPool(variants), [variants]);
  const cols = useMemo(() => activeColumns(variants), [variants]);
  const interval = (run.interval ?? item?.interval ?? event.interval) * 1000;
  const latest = run.called[run.called.length - 1];
  const left = pool.length - run.called.length;

  // Persist the run so a page reload doesn't lose the game.
  useEffect(() => {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(run));
    } catch {
      /* ignore */
    }
  }, [run]);

  // The auto-caller.
  useEffect(() => {
    if (run.phase !== 'calling' || now < run.nextCallAt) return;
    // Let the voice finish the previous call before drawing the next one.
    if (audio.enabled && isSpeaking() && now < run.nextCallAt + 5000) return;
    setRun((r) => {
      if (r.phase !== 'calling' || Date.now() < r.nextCallAt) return r;
      const n = drawFrom(pool, r.called);
      return n == null
        ? { ...r, phase: 'over', nextCallAt: null }
        : { ...r, called: [...r.called, n], nextCallAt: Date.now() + interval };
    });
  }, [now, run.phase, run.nextCallAt, pool, interval, audio.enabled]);

  // Speak each new number as it's called (not on reload or undo).
  const spokenCount = useRef(run.called.length);
  useEffect(() => {
    if (run.called.length > spokenCount.current && latest) announceNumber(latest);
    spokenCount.current = run.called.length;
  }, [run.called.length, latest]);

  // Announce the end of an intermission once.
  const breakAnnounced = useRef(null);
  useEffect(() => {
    if (run.phase !== 'break' || now < run.endsAt || breakAnnounced.current === run.index) return;
    breakAnnounced.current = run.index;
    const nxt = event.items[run.index + 1];
    if (audio.announce) say(`The intermission is over.${nxt ? ` Next up, ${nxt.name}.` : ''} Please take your seats.`);
  }, [now, run.phase, run.endsAt, run.index, event.items, audio.announce]);

  // Stop talking when leaving the caller.
  useEffect(() => stopSpeaking, []);

  // Publish what the TV should show.
  const next = event.items[run.index + 1];
  const screen = {
    eventName: event.name,
    kind: run.phase === 'end' ? 'end' : item?.type,
    phase: run.phase,
    position: run.index + 1,
    total: event.items.length,
    title: item?.name,
    patternName: isGame ? patternName(item) : null,
    patterns: isGame ? patternsForScreen(item) : [],
    activeCols: cols,
    called: run.called,
    nextCallAt: run.phase === 'calling' ? run.nextCallAt : null,
    interval,
    endsAt: run.endsAt ?? null,
    message: item?.type === 'break' ? item.message : '',
    nextUp: next ? (next.type === 'game' ? `${next.name}: ${patternName(next)}` : next.name) : null,
  };
  const screenKey = JSON.stringify(screen);
  useEffect(() => publishScreen(JSON.parse(screenKey)), [screenKey]);
  // Re-send now and then so a display opened later, or on a slow device, catches up.
  useEffect(() => {
    const t = setInterval(() => publishScreen(JSON.parse(screenKey)), 3000);
    return () => clearInterval(t);
  }, [screenKey]);

  // Actions
  const start = () => {
    unlockAudio();
    const intro = audio.enabled && audio.announce && run.called.length === 0;
    if (intro) say(`${item.name}. ${patternName(item)}. Here we go.`);
    setRun((r) => ({ ...r, phase: 'calling', nextCallAt: Date.now() + (r.called.length ? interval : intro ? 2500 : 1500) }));
  };
  const pause = () => setRun((r) => ({ ...r, phase: 'paused', remaining: Math.max(0, r.nextCallAt - Date.now()) }));
  const resume = () => unlockAudio() || setRun((r) => ({ ...r, phase: 'calling', nextCallAt: Date.now() + Math.min(r.remaining ?? interval, interval) }));
  const bingo = () => (audio.announce && say('Bingo! Please hold your cards while we check.'), setRun((r) => ({ ...r, phase: 'bingo', remaining: r.nextCallAt ? Math.max(0, r.nextCallAt - Date.now()) : null })));
  const falseAlarm = () => (audio.announce && say("That's not a bingo. We'll keep going."), setRun((r) => ({ ...r, phase: 'calling', nextCallAt: Date.now() + interval + 2500 })));
  const confirmWin = (announce = true) => {
    if (announce && audio.announce) say('We have a winner! Congratulations.');
    setRun((r) => ({ ...r, phase: 'over', nextCallAt: null }));
  };
  const sayAgain = () => latest && announceNumber(latest);
  const undo = () => setRun((r) => ({ ...r, called: r.called.slice(0, -1) }));
  const setSpeed = (sec) => setRun((r) => ({ ...r, interval: sec, nextCallAt: r.phase === 'calling' ? Math.min(r.nextCallAt, Date.now() + sec * 1000) : r.nextCallAt }));
  const goTo = (index) => {
    const inProgress = isGame && run.called.length > 0 && run.phase !== 'over';
    if (inProgress && !confirm('This game is still in progress. Leave it? Its called numbers will be cleared.')) return;
    setRun(freshState(event, index));
  };
  const addMinutes = (m) => setRun((r) => ({ ...r, endsAt: Math.max(Date.now(), r.endsAt) + m * 60000 }));

  // Space bar pauses and resumes.
  const keyRef = useRef();
  keyRef.current = { phase: run.phase, start, pause, resume };
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || /INPUT|TEXTAREA|BUTTON|SELECT/.test(e.target.tagName)) return;
      e.preventDefault();
      const k = keyRef.current;
      if (k.phase === 'calling') k.pause();
      else if (k.phase === 'paused') k.resume();
      else if (k.phase === 'ready') k.start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="caller">
      <header className="caller__top">
        <a href="#/" className="caller__back">All events</a>
        <h1 className="caller__event">{event.name}</h1>
        <a className="btn btn--quiet" href={`#/event/${event.id}`}>Edit event</a>
        <AudioControls />
        <TvHelp />
        <button className="btn btn--tv" onClick={openDisplayWindow}>Open TV display</button>
      </header>

      <aside className="runsheet" aria-label="Running order">
        <h2>Running order</h2>
        <ol>
          {event.items.map((it, i) => (
            <li key={it.id} className={`runsheet__item${i === run.index ? ' is-current' : ''}${i < run.index ? ' is-done' : ''}`}>
              <button onClick={() => i !== run.index && goTo(i)} aria-current={i === run.index ? 'step' : undefined}>
                <span className="runsheet__pos">{i + 1}</span>
                <span>
                  <strong>{it.name}</strong>
                  <span className="muted">{it.type === 'game' ? patternName(it) : `${it.minutes} min intermission`}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <main className="caller__main">
        {run.phase === 'end' && (
          <section className="stage stage--center">
            <h2 className="stage__title">That's the end of {event.name}</h2>
            <p className="muted">The TV is showing a thank-you screen.</p>
            <button className="btn" onClick={() => goTo(0)}>Start the event again</button>
          </section>
        )}

        {item?.type === 'break' && (
          <section className="stage stage--center">
            <p className="muted">Item {run.index + 1} of {event.items.length}</p>
            <h2 className="stage__title">{item.name}</h2>
            <p className="countdown">{fmtClock(run.endsAt - now)}</p>
            <div className="row row--center">
              <button className="btn" onClick={() => addMinutes(-1)}>Take off a minute</button>
              <button className="btn" onClick={() => addMinutes(1)}>Add a minute</button>
            </div>
            <button className="btn btn--primary btn--big" onClick={() => goTo(run.index + 1)}>
              {next ? `End intermission and go to ${next.name}` : 'End intermission and finish'}
            </button>
          </section>
        )}

        {isGame && (
          <section className="stage">
            <div className="stage__head">
              <div>
                <p className="muted">Item {run.index + 1} of {event.items.length}</p>
                <h2 className="stage__title">{item.name}</h2>
                <p className="stage__pattern">
                  {patternName(item)} <ColumnChips activeCols={cols} />
                </p>
              </div>
              <PatternSet patterns={patternsForScreen(item)} size="sm" />
            </div>

            {pool.length === 0 && (
              <p className="warn">This game's pattern has no squares marked, so there's nothing to call. Edit the event to draw the pattern.</p>
            )}

            <div className="console">
              <Ball n={latest} size="lg" />
              <div className="console__status">
                <p className="console__line">
                  {run.phase === 'ready' && 'Ready when you are.'}
                  {run.phase === 'calling' && `Next number in ${Math.max(0, Math.ceil((run.nextCallAt - now) / 1000))}s`}
                  {run.phase === 'paused' && 'Paused'}
                  {run.phase === 'bingo' && 'Bingo called. Check the card against the board.'}
                  {run.phase === 'over' && (left === 0 ? 'Every number in play has been called.' : 'Game over.')}
                </p>
                <p className="muted">
                  {run.called.length} called, {left} left in play
                </p>

                <div className="row">
                  {run.phase === 'ready' && <button className="btn btn--primary btn--big" onClick={start} disabled={!pool.length}>Start calling</button>}
                  {run.phase === 'calling' && <button className="btn btn--big" onClick={pause}>Pause</button>}
                  {run.phase === 'paused' && <button className="btn btn--primary btn--big" onClick={resume}>Resume calling</button>}
                  {(run.phase === 'calling' || run.phase === 'paused') && (
                    <button className="btn btn--bingo btn--big" onClick={bingo}>Bingo!</button>
                  )}
                  {run.phase === 'bingo' && (
                    <>
                      <button className="btn btn--primary btn--big" onClick={() => confirmWin()}>It's a winner, end game</button>
                      <button className="btn btn--big" onClick={falseAlarm}>Not a winner, keep calling</button>
                    </>
                  )}
                  {run.phase === 'over' && (
                    <button className="btn btn--primary btn--big" onClick={() => goTo(run.index + 1)}>
                      {next ? `Go to ${next.name}` : 'Finish the event'}
                    </button>
                  )}
                </div>

                <div className="row console__minor">
                  <label className="speed">
                    <span>Every {Math.round(interval / 1000)}s</span>
                    <input
                      type="range"
                      min={3}
                      max={30}
                      value={Math.round(interval / 1000)}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      aria-label="Seconds between calls"
                    />
                  </label>
                  {run.called.length > 0 && run.phase !== 'over' && (
                    <button className="btn btn--quiet" onClick={sayAgain} disabled={!audio.enabled}>Say it again</button>
                  )}
                  {run.called.length > 0 && run.phase !== 'over' && (
                    <button className="btn btn--quiet" onClick={undo} title="Take back the last number called">Undo {LETTERS[Math.floor((latest - 1) / 15)]} {latest}</button>
                  )}
                  {run.phase !== 'over' && run.phase !== 'ready' && (
                    <button className="btn btn--quiet" onClick={() => confirm('End this game now?') && confirmWin(false)}>End game</button>
                  )}
                </div>
              </div>
            </div>

            <Board called={run.called} activeCols={cols} latest={latest} size="md" />
          </section>
        )}
      </main>
    </div>
  );
}
