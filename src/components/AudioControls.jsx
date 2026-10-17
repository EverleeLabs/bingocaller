import { useEffect, useRef, useState } from 'react';
import { useAudioSettings, setAudio, useVoices, announceNumber, unlockAudio, speechSupported, DIGIT_PAUSES } from '../lib/voice.js';

/** Sound toggle plus a small panel of voice settings. */
export default function AudioControls() {
  const s = useAudioSettings();
  const voices = useVoices();
  const [open, setOpen] = useState(false);
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

  if (!speechSupported) {
    return <span className="muted">This browser can't read numbers aloud.</span>;
  }

  const test = () => {
    unlockAudio();
    announceNumber(52, { ...s, enabled: true });
  };

  return (
    <div className="audio" ref={ref}>
      <button
        className={`btn ${s.enabled ? '' : 'btn--muted'}`}
        aria-pressed={s.enabled}
        onClick={() => setAudio({ enabled: !s.enabled })}
        title={s.enabled ? 'Numbers are read aloud' : 'Numbers are silent'}
      >
        <SpeakerIcon on={s.enabled} />
        {s.enabled ? 'Sound on' : 'Sound off'}
      </button>
      <button className="btn btn--quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        Voice settings
      </button>

      {open && (
        <div className="audio__panel" role="dialog" aria-label="Voice settings">
          <label className="field">
            <span className="field__label">Voice</span>
            <select value={s.voiceURI} onChange={(e) => setAudio({ voiceURI: e.target.value })}>
              <option value="">Browser default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>

          <label className="audio__range">
            <span>Speed</span>
            <input type="range" min={0.6} max={1.3} step={0.05} value={s.rate} onChange={(e) => setAudio({ rate: Number(e.target.value) })} />
          </label>
          <label className="audio__range">
            <span>Volume</span>
            <input type="range" min={0.1} max={1} step={0.05} value={s.volume} onChange={(e) => setAudio({ volume: Number(e.target.value) })} />
          </label>

          <Check label="Say each number twice" checked={s.repeat} onChange={(v) => setAudio({ repeat: v })} />
          <Check label="Read the digits too (“G 52, five two”)" checked={s.digits} onChange={(v) => setAudio({ digits: v })} />
          {s.digits && (
            <label className="field audio__sub">
              <span className="field__label">Pause before the digits</span>
              <select value={s.digitPause} onChange={(e) => setAudio({ digitPause: Number(e.target.value) })}>
                {DIGIT_PAUSES.map((p) => (
                  <option key={p.ms} value={p.ms}>{p.label}</option>
                ))}
              </select>
            </label>
          )}
          <Check label="Chime before each number" checked={s.chime} onChange={(v) => setAudio({ chime: v })} />
          <Check label="Announce game starts, bingos and intermissions" checked={s.announce} onChange={(v) => setAudio({ announce: v })} />

          <button className="btn" onClick={test}>Play a test call</button>
          <p className="muted">
            Sound plays through this computer's speakers or wherever it's sending audio, such as the TV over AirPlay.
          </p>
        </div>
      )}
    </div>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="audio__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function SpeakerIcon({ on }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      ) : (
        <path d="m16 9 5 6m0-6-5 6" />
      )}
    </svg>
  );
}
