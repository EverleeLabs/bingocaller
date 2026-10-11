import { useEffect, useRef, useState } from 'react';

/** The board address for this site, with a Copy button. */
function DisplayLink() {
  const url = `${location.origin}${location.pathname}#/display`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address is still selectable */
    }
  };
  return (
    <span className="tvhelp__link">
      <code>{url}</code>
      <button type="button" className="btn btn--quiet" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

/** "How do I get this on the TV?" instructions next to the Open TV display button. */
export default function TvHelp() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('airplay');
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="audio" ref={ref}>
      <button className="btn btn--quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        Show on a TV
      </button>
      {open && (
        <div className="audio__panel tvhelp" role="dialog" aria-label="Show the board on a TV">
          <div className="tvhelp__tabs" role="tablist">
            {[
              ['airplay', 'AirPlay (Mac)'],
              ['ipad', 'iPad'],
              ['hdmi', 'HDMI cable'],
              ['other', 'Chromecast / PC'],
            ].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'airplay' && (
            <ol className="tvhelp__steps">
              <li>Click <strong>Open TV display</strong>. The board opens in its own window.</li>
              <li>On the Mac menu bar, open <strong>Control Center → Screen Mirroring</strong> and pick the Apple TV or AirPlay TV.</li>
              <li>
                Make the TV a second screen instead of a copy: in the same Screen Mirroring menu choose <strong>Use As Separate Display</strong>{' '}
                (or in System Settings → Displays, set the TV to <strong>Extended display</strong>).
              </li>
              <li>Drag the board window onto the TV and click <strong>Full screen</strong>.</li>
              <li>For the calls to come out of the TV speakers, open <strong>Control Center → Sound</strong> and pick the TV.</li>
            </ol>
          )}
          {tab === 'ipad' && (
            <>
              <p className="tvhelp__note">
                Works on iPads with an M-series chip (iPad Air 5th generation or later, iPad Pro M1 or later) using a USB-C to HDMI
                cable. AirPlay only mirrors the iPad, so use the cable.
              </p>
              <ol className="tvhelp__steps">
                <li>Turn on <strong>Stage Manager</strong> (Control Center, or Settings → Multitasking &amp; Gestures).</li>
                <li>Plug the iPad into the TV with a USB-C to HDMI adapter. One with a charging port keeps the iPad powered.</li>
                <li>Keep this caller screen open in Safari on the iPad.</li>
                <li>
                  Open a <strong>new Safari window on the TV screen</strong> (drag Safari from the Dock onto the TV, or press and hold the
                  Safari icon and choose New Window) and go to this address:
                  <DisplayLink />
                </li>
                <li>Tap <strong>Full screen</strong> on the board. Run the game from the iPad; the TV follows along and plays the calls.</li>
              </ol>
              <p className="muted">
                Use regular Safari windows, not Private Browsing, or the two windows can't see each other. Set Auto-Lock to Never so the
                iPad stays awake. iPhones and older iPads can only mirror their screen to a TV.
              </p>
            </>
          )}
          {tab === 'hdmi' && (
            <ol className="tvhelp__steps">
              <li>Plug the laptop into the TV and switch the TV to that HDMI input.</li>
              <li>Set the TV as an extended display (Mac: System Settings → Displays; Windows: press Windows + P, choose Extend).</li>
              <li>Click <strong>Open TV display</strong>, drag the window onto the TV and click <strong>Full screen</strong>.</li>
              <li>Pick the TV as the sound output if you want the calls through its speakers.</li>
            </ol>
          )}
          {tab === 'other' && (
            <ol className="tvhelp__steps">
              <li>Click <strong>Open TV display</strong>.</li>
              <li>In Chrome, in the board window, open the <strong>⋮ menu → Cast</strong>, choose the Chromecast or Google TV, and set Sources to <strong>Cast tab</strong>.</li>
              <li>Windows with a Miracast TV: press Windows + K to connect, then Windows + P and choose <strong>Extend</strong>, and drag the window over.</li>
            </ol>
          )}
          {tab !== 'ipad' && (
            <p className="muted">Keep the caller screen on the laptop. The TV window updates on its own as numbers are called.</p>
          )}
        </div>
      )}
    </div>
  );
}
