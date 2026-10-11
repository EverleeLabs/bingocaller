import { useEffect, useState } from 'react';
import { useScreen, useNow } from '../lib/sync.js';
import { Board, Ball, PatternSet, fmtClock } from '../components/Bingo.jsx';
import { letterOf } from '../lib/patterns.js';

export default function Display() {
  const screen = useScreen();
  const now = useNow(250);
  const idle = useIdleCursor();
  useWakeLock();

  useEffect(() => {
    document.title = screen?.eventName ? `${screen.eventName} board` : 'Bingo board';
  }, [screen?.eventName]);

  return (
    <div className={`tv${idle ? ' is-idle' : ''}`}>
      <button className="tv__fs" onClick={toggleFullscreen}>
        {document.fullscreenElement ? 'Exit full screen' : 'Full screen'}
      </button>
      {!screen && <Waiting />}
      {screen?.kind === 'game' && <GameScreen s={screen} now={now} />}
      {screen?.kind === 'break' && <BreakScreen s={screen} now={now} />}
      {screen?.kind === 'end' && (
        <div className="tv__center">
          <p className="tv__event">{screen.eventName}</p>
          <h1 className="tv__huge">Thanks for playing</h1>
        </div>
      )}
    </div>
  );
}

function Waiting() {
  return (
    <div className="tv__center">
      <h1 className="tv__huge">Bingo</h1>
      <p className="tv__sub">Waiting for the caller. Start an event on the caller screen and this board will follow along.</p>
    </div>
  );
}

function GameScreen({ s, now }) {
  const latest = s.called[s.called.length - 1];
  const recent = s.called.slice(-6, -1).reverse();
  const [fresh, setFresh] = useState(latest);
  useEffect(() => setFresh(latest), [latest]);

  return (
    <div className="tv__game">
      <header className="tv__bar">
        <span className="tv__event">{s.eventName}</span>
        <h1 className="tv__title">{s.title}</h1>
        <span className="tv__count">
          {s.called.length} {s.called.length === 1 ? 'number' : 'numbers'} called
        </span>
      </header>

      <section className="tv__left">
        <div className="tv__ballwrap" key={fresh}>
          <Ball n={latest} size="xl" />
        </div>
        {s.phase === 'bingo' && <p className="tv__alert">Bingo! Checking the card</p>}
        {s.phase === 'paused' && <p className="tv__note">Paused</p>}
        {s.phase === 'ready' && <p className="tv__note">Get your cards ready</p>}
        {s.phase === 'over' && <p className="tv__note">Game over</p>}
        {s.phase === 'calling' && s.nextCallAt && (
          <Progress remaining={s.nextCallAt - now} total={s.interval} />
        )}
        {recent.length > 0 && (
          <div className="tv__recent" aria-label="Previous numbers">
            {recent.map((n) => (
              <Ball key={n} n={n} size="sm" />
            ))}
          </div>
        )}
        <div className={`tv__pattern${(s.patterns || []).length > 1 ? ' is-multi' : ''}`}>
          <p className="tv__pattern-label">{(s.patterns || []).length > 1 ? 'To win, complete any one' : 'To win'}</p>
          <PatternSet patterns={s.patterns || []} size="tv" />
        </div>
      </section>

      <section className="tv__right">
        <Board called={s.called} activeCols={s.activeCols} latest={latest} size="xl" />
      </section>
      {latest && <p className="sr-only" aria-live="polite">{`${letterOf(latest)} ${latest}`}</p>}
    </div>
  );
}

function Progress({ remaining, total }) {
  const pct = Math.max(0, Math.min(1, 1 - remaining / total));
  return (
    <div className="tv__progress" aria-hidden>
      <span style={{ transform: `scaleX(${pct})` }} />
    </div>
  );
}

function BreakScreen({ s, now }) {
  const left = s.endsAt - now;
  return (
    <div className="tv__center">
      <p className="tv__event">{s.eventName}</p>
      <h1 className="tv__title">{s.title}</h1>
      <p className="tv__clock">{left > 0 ? fmtClock(left) : 'Starting soon'}</p>
      {s.message && <p className="tv__sub">{s.message}</p>}
      {s.nextUp && <p className="tv__next">Next up: {s.nextUp}</p>}
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

function useIdleCursor() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2500);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('touchstart', wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
    };
  }, []);
  return idle;
}

/** Keep the screen from sleeping where the browser allows it. */
function useWakeLock() {
  useEffect(() => {
    let lock;
    const get = () => navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    get();
    const onVis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release?.();
    };
  }, []);
}
