import { useEffect, useMemo, useRef, useState } from 'react';
import { useEvents, updateEvent } from '../lib/store.js';
import { variantsFor, activeColumns, callPool, patternName, selectedPatterns, callLimitFor, isMilestone, milestoneText, DEFAULT_PRIZE_MESSAGE, LETTERS } from '../lib/patterns.js';
import { publishScreen, openDisplayWindow, useWorkerNow } from '../lib/sync.js';
import { Board, Ball, PatternSet, ColumnChips, fmtClock } from '../components/Bingo.jsx';
import { announceNumber, say, isSpeaking, unlockAudio, stopSpeaking, useAudioSettings } from '../lib/voice.js';
import AudioControls from '../components/AudioControls.jsx';
import TvHelp from '../components/TvHelp.jsx';

const RUN_KEY = 'bingo.run.v1';

// Special prize: when switched on for the current game and this number is
// called, calling pauses and the announcement below is read out and shown.
const PRIZE_NUMBER = 69; // O 69
const PRIZE_KEY = 'bingo.prize.v1'; // older versions kept the wording per device

function legacyPrizeMessage() {
  try {
    return localStorage.getItem(PRIZE_KEY) || '';
  } catch {
    return '';
  }
}

// phase for a game: ready → calling ⇄ paused → bingo (checking a card) → over
// phase for an intermission: break
// index === items.length means the event is finished.

function freshState(event, index) {
  const item = event.items[index];
  if (!item) return { eventId: event.id, index, phase: 'end', called: [] };
  if (item.type === 'break') return { eventId: event.id, index, phase: 'break', called: [], endsAt: Date.now() + item.minutes * 60000 };
  return { eventId: event.id, index, phase: 'ready', called: [], interval: null, nextCallAt: null, remaining: null, extra: 0 };
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
  // Optional limit on numbers called this game; "extra" is what the caller added during play.
  // "Keep going until a bingo" (run.untilBingo) lifts the limit for the rest of this game.
  const limit = isGame && !run.untilBingo ? callLimitFor(item, pool.length, run.extra || 0) : null;
  const limitLifted = isGame && !!run.untilBingo && !!item.callLimit?.enabled;
  const atLimit = limit != null && run.called.length >= limit;
  // The O 69 prize is only offered when O numbers can be called this game.
  const prizeAvailable = isGame && pool.includes(PRIZE_NUMBER);
  const prizeOn = prizeAvailable && !!run.prizeOn;
  // The prize wording is saved with the event (set it in setup or here during the game).
  const prizeMessage = (event.prizeMessage ?? '').trim() || legacyPrizeMessage() || DEFAULT_PRIZE_MESSAGE;
  const setPrizeMessage = (text) => updateEvent(event.id, { prizeMessage: text });
  // Read out and shown on the TV when the event ends.
  const closingMessage = (event.endMessage ?? '').trim() || `That's the end of ${event.name}. Thanks for playing!`;

  // Persist the run so a page reload doesn't lose the game.
  useEffect(() => {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(run));
    } catch {
      /* ignore */
    }
  }, [run]);

  /** Draw one number. Used by the auto-caller and by "Call next now". */
  function drawNext(r) {
    if (limit != null && r.called.length >= limit) return { ...r, phase: 'limit', nextCallAt: null };
    const n = drawFrom(pool, r.called);
    if (n == null) return { ...r, phase: 'over', nextCallAt: null };
    const called = [...r.called, n];
    // Special prize number: stop so the prize can be announced.
    if (prizeOn && n === PRIZE_NUMBER) return { ...r, called, phase: 'prize', nextCallAt: null };
    // Stop right after the last allowed number.
    if (limit != null && called.length >= limit) return { ...r, called, phase: 'limit', nextCallAt: null };
    return { ...r, called, nextCallAt: r.phase === 'calling' ? Date.now() + interval : null };
  }

  // The auto-caller.
  useEffect(() => {
    if (run.phase !== 'calling' || now < run.nextCallAt) return;
    // Let the voice finish the previous call before drawing the next one.
    if (audio.enabled && isSpeaking() && now < run.nextCallAt + 5000) return;
    setRun((r) => (r.phase !== 'calling' || Date.now() < r.nextCallAt ? r : drawNext(r)));
  }, [now, run.phase, run.nextCallAt, pool, interval, audio.enabled, limit, prizeOn]);

  // Speak each new number as it's called (not on reload or undo).
  const spokenCount = useRef(run.called.length);
  useEffect(() => {
    if (run.called.length > spokenCount.current && latest) {
      const reached = limit != null && run.called.length === limit && audio.announce;
      const prize = prizeOn && latest === PRIZE_NUMBER;
      // A milestone the host asked for ("That's 40 numbers called. 10 to go."), unless it's the final number.
      const milestone = audio.announce && !reached && limit != null && isMilestone(item, run.called.length) ? milestoneText(run.called.length, limit, item.callLimit?.message) : '';
      const after = [prize ? prizeMessage : '', milestone, reached ? `That's ${limit} numbers.` : ''].filter(Boolean).join(' ... ');
      announceNumber(latest, undefined, after);
    }
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
    limit,
    prizeMessage: run.phase === 'prize' ? prizeMessage : null,
    untilBingo: limitLifted,
    endMessage: run.phase === 'end' ? closingMessage : null,
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
  const falseAlarm = () => {
    if (atLimit) {
      if (audio.announce) say("That's not a bingo.");
      setRun((r) => ({ ...r, phase: 'limit', nextCallAt: null }));
      return;
    }
    if (audio.announce) say("That's not a bingo. We'll keep going.");
    setRun((r) => ({ ...r, phase: 'calling', nextCallAt: Date.now() + interval + 2500 }));
  };
  /** Raise the limit by n. If calling had stopped at the limit, carry on. */
  const addMore = (n) => {
    if (!Number.isFinite(n) || n < 1) return;
    unlockAudio();
    const resumeNow = run.phase === 'limit';
    if (resumeNow && audio.announce) say(`${n} more ${n === 1 ? 'number' : 'numbers'}. Here we go.`);
    setRun((r) => ({
      ...r,
      extra: (r.extra || 0) + n,
      ...(r.phase === 'limit' ? { phase: 'calling', nextCallAt: Date.now() + (audio.announce ? 2500 : 1200) } : {}),
    }));
  };
  const [customMore, setCustomMore] = useState('');
  /** Drop the number limit for the rest of this game and keep calling until someone wins. */
  const keepGoing = () => {
    unlockAudio();
    const resumeNow = run.phase === 'limit';
    if (audio.announce) say("We'll keep going until there's a bingo.");
    setRun((r) => ({
      ...r,
      untilBingo: true,
      ...(r.phase === 'limit' ? { phase: 'calling', nextCallAt: Date.now() + (audio.announce ? 3000 : 1200) } : {}),
    }));
    return resumeNow;
  };
  const confirmWin = (announce = true) => {
    if (announce && audio.announce) say('We have a winner! Congratulations.');
    setRun((r) => ({ ...r, phase: 'over', nextCallAt: null }));
  };
  const sayAgain = () => latest && announceNumber(latest, undefined, run.phase === 'prize' ? prizeMessage : '');
  /** Call the next number straight away. While paused (or before starting) it steps one number at a time. */
  const callNow = () => {
    unlockAudio();
    stopSpeaking();
    setRun((r) => {
      if (!['ready', 'calling', 'paused'].includes(r.phase)) return r;
      return drawNext(r.phase === 'ready' ? { ...r, phase: 'paused', remaining: null } : r);
    });
  };
  const togglePrize = (on) => setRun((r) => ({ ...r, prizeOn: on }));
  const resumeAfterPrize = () => {
    unlockAudio();
    setRun((r) => ({ ...r, phase: 'calling', nextCallAt: Date.now() + 1500 }));
  };
  const undo = () => setRun((r) => ({ ...r, called: r.called.slice(0, -1), phase: r.phase === 'limit' || r.phase === 'prize' ? 'paused' : r.phase, remaining: r.phase === 'limit' || r.phase === 'prize' ? interval : r.remaining }));
  const setSpeed = (sec) => setRun((r) => ({ ...r, interval: sec, nextCallAt: r.phase === 'calling' ? Math.min(r.nextCallAt, Date.now() + sec * 1000) : r.nextCallAt }));
  /** End the whole event: thank-you screen on the TV and the closing message read out. */
  const endEvent = () => {
    const inProgress = isGame && run.called.length > 0 && !['over', 'end'].includes(run.phase);
    if (inProgress && !confirm('A game is still in progress. End the whole event now?')) return;
    unlockAudio();
    if (audio.enabled) say(closingMessage);
    setRun(freshState(event, event.items.length));
  };
  const goTo = (index) => {
    const inProgress = isGame && run.called.length > 0 && run.phase !== 'over';
    if (inProgress && !confirm('This game is still in progress. Leave it? Its called numbers will be cleared.')) return;
    setRun(freshState(event, index));
  };
  const addMinutes = (m) => setRun((r) => ({ ...r, endsAt: Math.max(Date.now(), r.endsAt) + m * 60000 }));

  // Space bar pauses and resumes.
  const keyRef = useRef();
  keyRef.current = { phase: run.phase, start, pause, resume, resumeAfterPrize, callNow };
  useEffect(() => {
    const onKey = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = keyRef.current;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        k.callNow();
        return;
      }
      if (e.code !== 'Space' || e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      if (k.phase === 'calling') k.pause();
      else if (k.phase === 'paused') k.resume();
      else if (k.phase === 'ready') k.start();
      else if (k.phase === 'prize') k.resumeAfterPrize();
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
        {run.phase !== 'end' && (
          <button className="btn btn--quiet" onClick={endEvent}>End event</button>
        )}
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
            <p className="muted">The TV is showing a thank-you screen with your closing message:</p>
            <p className="closing-preview">{closingMessage}</p>
            <div className="row row--center">
              <a className="btn btn--primary" href="#/">Back to all events</a>
              <button className="btn" onClick={() => audio.enabled && say(closingMessage)} disabled={!audio.enabled}>Play the message again</button>
              <button className="btn btn--quiet" onClick={() => goTo(0)}>Start the event again</button>
            </div>
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
            <button className="btn btn--primary btn--big" onClick={() => (next ? goTo(run.index + 1) : endEvent())}>
              {next ? `End intermission and go to ${next.name}` : 'End intermission and end the event'}
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
              <div className="console__balls">
                <Ball n={latest} size="lg" />
                {run.called.length > 1 && (
                  <div className="console__recent">
                    <span className="console__recent-label">Before that</span>
                    <div className="console__recent-balls">
                      {run.called.slice(-6, -1).reverse().map((n) => (
                        <Ball key={n} n={n} size="sm" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="console__status">
                <p className="console__line">
                  {run.phase === 'ready' && 'Ready when you are.'}
                  {run.phase === 'calling' && `Next number in ${Math.max(0, Math.ceil((run.nextCallAt - now) / 1000))}s`}
                  {run.phase === 'paused' && 'Paused'}
                  {run.phase === 'bingo' && 'Bingo called. Check the card against the board.'}
                  {run.phase === 'over' && (left === 0 ? 'Every number in play has been called.' : 'Game over.')}
                  {run.phase === 'limit' && `That's all ${limit} numbers.`}
                  {run.phase === 'prize' && 'O 69: special prize!'}
                </p>
                {run.phase === 'prize' && <p className="prize-banner">{prizeMessage}</p>}
                <p className="muted">
                  {limit != null
                    ? `${run.called.length} of ${limit} called${(run.extra || 0) > 0 ? ` (${run.extra} added)` : ''}, ${left} left in play`
                    : `${run.called.length} called, ${left} left in play${limitLifted ? ', playing until a bingo' : ''}`}
                </p>

                <div className="row">
                  {run.phase === 'ready' && <button className="btn btn--primary btn--big" onClick={start} disabled={!pool.length}>Start calling</button>}
                  {run.phase === 'calling' && <button className="btn btn--big" onClick={pause}>Pause</button>}
                  {run.phase === 'paused' && <button className="btn btn--primary btn--big" onClick={resume}>Resume calling</button>}
                  {run.phase === 'prize' && <button className="btn btn--primary btn--big" onClick={resumeAfterPrize}>Resume calling</button>}
                  {run.phase === 'limit' && left > 0 && (
                    <>
                      <button className="btn btn--primary btn--big" onClick={() => addMore(5)}>Add 5 more</button>
                      <button className="btn btn--big" onClick={() => addMore(10)}>Add 10 more</button>
                      <button className="btn btn--big" onClick={keepGoing}>Keep going until a bingo</button>
                    </>
                  )}
                  {(run.phase === 'calling' || run.phase === 'paused' || run.phase === 'limit' || run.phase === 'prize') && (
                    <button className="btn btn--bingo btn--big" onClick={bingo}>Bingo!</button>
                  )}
                  {run.phase === 'bingo' && (
                    <>
                      <button className="btn btn--primary btn--big" onClick={() => confirmWin()}>It's a winner, end game</button>
                      <button className="btn btn--big" onClick={falseAlarm}>Not a winner, keep calling</button>
                    </>
                  )}
                  {run.phase === 'over' && (
                    <button className="btn btn--primary btn--big" onClick={() => (next ? goTo(run.index + 1) : endEvent())}>
                      {next ? `Go to ${next.name}` : 'End the event'}
                    </button>
                  )}
                </div>

                {/* Hidden once O 69 has been called and the game has moved on. */}
                {prizeAvailable && run.phase !== 'over' && (!run.called.includes(PRIZE_NUMBER) || run.phase === 'prize') && (
                  <div className={`prize${prizeOn ? ' is-on' : ''}`}>
                    <label className="switch">
                      <input type="checkbox" role="switch" checked={prizeOn} onChange={(e) => togglePrize(e.target.checked)} />
                      <span className="switch__track" aria-hidden />
                      <span>Special prize on O 69</span>
                    </label>
                    {prizeOn && (
                      <>
                        <label className="prize__message">
                          <span className="field__label">Announcement</span>
                          <input value={event.prizeMessage ?? prizeMessage} onChange={(e) => setPrizeMessage(e.target.value)} placeholder={DEFAULT_PRIZE_MESSAGE} />
                        </label>
                        {run.phase !== 'prize' && (
                          <p className="muted">When O 69 is called, calling pauses and this is read out and shown on the TV.</p>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="row console__minor">
                  <label className="speed">
                    <span>Every {Math.round(interval / 1000)}s</span>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={Math.round(interval / 1000)}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      aria-label="Seconds between calls"
                    />
                  </label>
                  {['ready', 'calling', 'paused'].includes(run.phase) && left > 0 && (
                    <button className="btn btn--quiet" onClick={callNow} title="Shortcut: N">Call next now</button>
                  )}
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

                {limit != null && run.phase !== 'over' && left > 0 && (
                  <form
                    className="row more"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addMore(parseInt(customMore, 10));
                      setCustomMore('');
                    }}
                  >
                    <span className="more__label">{run.phase === 'limit' ? 'Or add' : 'Add more numbers'}</span>
                    {run.phase !== 'limit' && (
                      <>
                        <button type="button" className="btn btn--quiet" onClick={() => addMore(5)}>+5</button>
                        <button type="button" className="btn btn--quiet" onClick={() => addMore(10)}>+10</button>
                        <button type="button" className="btn btn--quiet" onClick={keepGoing}>Keep going until a bingo</button>
                      </>
                    )}
                    <input
                      type="number"
                      min={1}
                      max={left}
                      value={customMore}
                      onChange={(e) => setCustomMore(e.target.value)}
                      placeholder="How many"
                      aria-label="How many more numbers"
                    />
                    <button type="submit" className="btn" disabled={!(parseInt(customMore, 10) > 0)}>Add</button>
                  </form>
                )}
              </div>
            </div>

            <Board called={run.called} activeCols={cols} latest={latest} size="md" />
          </section>
        )}
      </main>
    </div>
  );
}
