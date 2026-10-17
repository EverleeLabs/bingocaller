import { useRef } from 'react';
import { updateEvent, uid } from '../lib/store.js';
import { DEFAULT_FALSE_BINGO, DEFAULT_BANKS, pickLine } from '../lib/quips.js';
import { say, unlockAudio, useAudioSettings } from '../lib/voice.js';

/** The event's cheeky replies: one list for a bingo that isn't, and lists to use any time during a game. */
export default function RepliesEditor({ event }) {
  const audio = useAudioSettings();
  const recent = useRef({});
  const falseLines = event.falseBingoReplies ?? DEFAULT_FALSE_BINGO;
  const banks = event.quipBanks ?? DEFAULT_BANKS;
  const custom = event.falseBingoReplies != null || event.quipBanks != null;

  const setBanks = (fn) => updateEvent(event.id, (e) => ({ quipBanks: fn(e.quipBanks ?? DEFAULT_BANKS) }));
  const patchBank = (id, patch) => setBanks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const hear = (key, lines) => {
    const line = pickLine(lines.map((l) => l.trim()).filter(Boolean), (recent.current[key] ||= []));
    if (!line) return;
    unlockAudio();
    say(line, { ...audio, enabled: true });
  };

  return (
    <section className="replies" aria-labelledby="replies-title">
      <div className="row row--between">
        <h2 id="replies-title">Cheeky replies</h2>
        {custom && (
          <button
            className="btn btn--quiet replies__tools"
            onClick={() => confirm('Put back the built-in replies? Your changes to these lists will be lost.') && updateEvent(event.id, { falseBingoReplies: undefined, quipBanks: undefined })}
          >
            Use the built-in replies
          </button>
        )}
      </div>
      <p className="muted">
        One reply per line. The caller picks one at random (never the same one twice in a row), reads it out and shows it on the TV.
      </p>

      <div className="bank">
        <span className="field__label">When it's not a bingo</span>
        <Lines lines={falseLines} onChange={(lines) => updateEvent(event.id, { falseBingoReplies: lines })} />
        <p className="muted">
          Used by <strong>Not a winner, with a cheeky reply</strong> after a card is checked. Leave empty to hide that button.
        </p>
        <div className="row">
          <button className="btn btn--quiet" onClick={() => hear('false-bingo', falseLines)}>Hear one</button>
        </div>
      </div>

      {banks.map((b) => (
        <div key={b.id} className="bank">
          <div className="bank__head">
            <label className="field">
              <span className="field__label">Button on the caller screen</span>
              <input value={b.name} maxLength={40} onChange={(e) => patchBank(b.id, { name: e.target.value })} />
            </label>
            <button className="btn btn--quiet" onClick={() => hear(b.id, b.lines)}>Hear one</button>
            <button className="btn btn--quiet btn--danger" onClick={() => setBanks((bs) => bs.filter((x) => x.id !== b.id))}>Remove list</button>
          </div>
          <Lines lines={b.lines} onChange={(lines) => patchBank(b.id, { lines })} />
        </div>
      ))}

      <div className="row">
        <button className="btn" onClick={() => setBanks((bs) => [...bs, { id: uid(), name: 'New replies', lines: [] }])} disabled={banks.length >= 12}>
          Add a list of replies
        </button>
        <p className="muted">Each list gets a button under <strong>Say something</strong> during a game.</p>
      </div>
    </section>
  );
}

function Lines({ lines, onChange }) {
  return (
    <textarea
      rows={Math.min(10, Math.max(3, lines.length + 1))}
      value={lines.join('\n')}
      placeholder="Type a reply, then press Enter for the next one"
      onChange={(e) => onChange(e.target.value.split('\n').slice(0, 100))}
    />
  );
}
