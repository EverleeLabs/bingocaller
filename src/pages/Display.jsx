import { useEffect, useState } from 'react';
import { useScreen, useNow } from '../lib/sync.js';
import { Board, Ball, PatternSet, Brand, CornerLogo, fmtClock } from '../components/Bingo.jsx';
import { letterOf } from '../lib/patterns.js';
import { themeStyle } from '../lib/theme.js';
import { usePictures } from '../lib/pictures.js';

export default function Display() {
  const screen = useScreen();
  const now = useNow(250);
  const idle = useIdleCursor();
  useWakeLock();

  useEffect(() => {
    document.title = screen?.eventName ? `${screen.eventName} board` : 'Bingo board';
  }, [screen?.eventName]);

  // The event's colours (or the current game's own) on every screen.
  const { image, logo } = usePictures(screen?.theme);

  return (
    <div className={`tv${idle ? ' is-idle' : ''}${image ? ' has-image' : ''}`} style={screen ? themeStyle(screen.theme, image) : undefined}>
      <button className="tv__fs" onClick={toggleFullscreen}>
        {document.fullscreenElement ? 'Exit full screen' : 'Full screen'}
      </button>
      {screen && <CornerLogo logo={logo} theme={screen.theme} />}
      {!screen && <Waiting />}
      {screen?.kind === 'game' && <GameScreen s={screen} logo={logo} now={now} />}
      {screen?.kind === 'break' && <BreakScreen s={screen} logo={logo} now={now} />}
      {screen?.kind === 'end' && (
        <div className="tv__center">
          <Brand logo={logo} theme={screen.theme} eventName={screen.eventName} />
          <h1 className="tv__huge">Thanks for playing</h1>
          {screen.endMessage && <p className="tv__sub">{screen.endMessage}</p>}
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

function GameScreen({ s, logo, now }) {
  const latest = s.called[s.called.length - 1];
  const recent = s.called.slice(-6, -1).reverse();
  const [fresh, setFresh] = useState(latest);
  useEffect(() => setFresh(latest), [latest]);

  return (
    <div className="tv__game">
      <header className="tv__bar">
        <div className="tv__game-info">
          <h1 className="tv__title">{s.title}</h1>
          <span className="tv__count">
            {s.limit != null
              ? `${s.called.length} of ${s.limit} numbers called`
              : `${s.called.length} ${s.called.length === 1 ? 'number' : 'numbers'} called${s.untilBingo ? ', playing until a bingo' : ''}`}
          </span>
        </div>
        <Brand logo={logo} theme={s.theme} eventName={s.eventName} />
      </header>

      <section className="tv__left">
        <div className="tv__ballwrap" key={fresh}>
          <Ball n={latest} size="xl" />
        </div>
        {s.phase === 'bingo' && <p className="tv__alert">Bingo! Checking the card</p>}
        {s.phase === 'paused' && <p className="tv__note">Paused</p>}
        {s.phase === 'ready' && <p className="tv__note">Get your cards ready</p>}
        {s.phase === 'over' && !s.tiebreaker && <p className="tv__note">Game over</p>}
        {s.phase === 'over' && s.tiebreaker && (
          <div className="tv__prize" role="status">
            <p className="tv__alert">Tie breaker!</p>
            <p className="tv__prize-message">{s.tiebreaker}</p>
          </div>
        )}
        {s.phase === 'limit' && <p className="tv__note">That's all {s.limit} numbers</p>}
        {s.phase === 'prize' && (
          <div className="tv__prize" role="status">
            <p className="tv__alert">Special prize!</p>
            {s.prizeMessage && <p className="tv__prize-message">{s.prizeMessage}</p>}
          </div>
        )}
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
      <Shout s={s} now={now} />
    </div>
  );
}

const SHOUT_LABELS = { reminder: 'Reminder', 'false-bingo': 'Not a bingo' };

/** The start-of-game reminder or a cheeky reply, shown over the board for a few seconds. */
function Shout({ s, now }) {
  const shout = s.shout && now < s.shout.until ? s.shout : s.reminder ? { text: s.reminder, kind: 'reminder' } : null;
  if (!shout) return null;
  const label = SHOUT_LABELS[shout.kind];
  return (
    <div className={`tv__shout tv__shout--${shout.kind}`} key={`${shout.kind}:${shout.text}`} role="status">
      {label && <span className="tv__shout-label">{label}</span>}
      <p>{shout.text}</p>
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

function BreakScreen({ s, logo, now }) {
  const left = s.endsAt - now;
  return (
    <div className="tv__center">
      <Brand logo={logo} theme={s.theme} eventName={s.eventName} />
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
