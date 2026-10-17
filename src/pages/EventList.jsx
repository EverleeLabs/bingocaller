import { useRef, useState } from 'react';
import { useEvents, createEvent, deleteEvent, duplicateEvent, importEvents, isSavedHere } from '../lib/store.js';
import { downloadEvents, parseBackup, backupFilename, eventFilename } from '../lib/backup.js';
import { withPictures, storeImportedPictures } from '../lib/pictures.js';
import { navigate } from '../App.jsx';

export default function EventList() {
  const events = useEvents();
  const fileRef = useRef();
  const [pending, setPending] = useState(null); // { fileName, events, picked: Set, skipped }
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const onCreate = () => navigate(`/event/${createEvent().id}`);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setStatus('');
    try {
      const { events: found, skipped } = parseBackup(await file.text());
      setPending({ fileName: file.name, events: found, picked: new Set(found.map((x) => x.id)), skipped });
    } catch (err) {
      setPending(null);
      setError(err.message);
    }
  };

  const togglePick = (id) =>
    setPending((p) => {
      const picked = new Set(p.picked);
      picked.has(id) ? picked.delete(id) : picked.add(id);
      return { ...p, picked };
    });

  const exportEvents = async (list, filename) => downloadEvents(await withPictures(list), filename);

  const confirmImport = async () => {
    const chosen = await storeImportedPictures(pending.events.filter((x) => pending.picked.has(x.id)));
    if (!chosen) {
      setError('This browser is out of room to save the pictures in that file.');
      return;
    }
    const { added, replaced } = importEvents(chosen);
    const ev = (n) => `${n} ${n === 1 ? 'event' : 'events'}`;
    const parts = [];
    if (added) parts.push(`Added ${ev(added)}.`);
    if (replaced) parts.push(`Replaced ${ev(replaced)} with the copy from the file.`);
    setStatus(parts.join(' '));
    setPending(null);
  };

  return (
    <main className="page page--narrow">
      <header className="masthead">
        <h1 className="wordmark" aria-label="Bingo caller">
          {'BINGO'.split('').map((l, i) => (
            <span key={l} className={`wordmark__ball col-${i}`}>{l}</span>
          ))}
          <span className="wordmark__rest">caller</span>
        </h1>
        <p className="lede">Plan your games, then let the caller draw numbers while the TV shows the board.</p>
      </header>

      <section className="stack">
        <div className="row row--between">
          <h2>Your events</h2>
          <div className="row">
            <button className="btn btn--quiet" onClick={() => fileRef.current.click()}>Import</button>
            {events.length > 0 && (
              <button className="btn btn--quiet" onClick={() => exportEvents(events, backupFilename())}>
                Export all
              </button>
            )}
            <button className="btn btn--primary" onClick={onCreate}>New event</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
        </div>

        {error && <p className="warn" role="alert">{error}</p>}
        {status && <p className="callout" role="status">{status}</p>}

        {pending && (
          <section className="import" aria-label="Import events">
            <h3>Import from {pending.fileName}</h3>
            <p className="muted">
              Choose which events to bring into this browser.
              {pending.skipped > 0 && ` ${pending.skipped} ${pending.skipped === 1 ? 'entry' : 'entries'} in the file couldn't be read and will be left out.`}
            </p>
            <ul className="import__list">
              {pending.events.map((ev) => {
                const games = ev.items.filter((i) => i.type === 'game').length;
                const replaces = isSavedHere(ev.id);
                return (
                  <li key={ev.id}>
                    <label className="import__row">
                      <input type="checkbox" checked={pending.picked.has(ev.id)} onChange={() => togglePick(ev.id)} />
                      <span className="import__name">
                        <strong>{ev.name}</strong>
                        <span className="muted">
                          {games} {games === 1 ? 'game' : 'games'}, {ev.items.length - games} {ev.items.length - games === 1 ? 'intermission' : 'intermissions'}
                        </span>
                      </span>
                      <span className={`tag${replaces ? ' tag--replace' : ''}`}>
                        {replaces ? 'Replaces the saved copy' : 'New'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="row">
              <button className="btn btn--primary" onClick={confirmImport} disabled={!pending.picked.size}>
                Import {pending.picked.size} {pending.picked.size === 1 ? 'event' : 'events'}
              </button>
              <button className="btn btn--quiet" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </section>
        )}

        {events.length === 0 ? (
          <div className="empty">
            <p>No events yet. Create one to set up your games, the way to win each, and any intermissions. Or import events you exported before.</p>
            <div className="row row--center">
              <button className="btn btn--primary" onClick={onCreate}>Create your first event</button>
              <button className="btn" onClick={() => fileRef.current.click()}>Import from a file</button>
            </div>
          </div>
        ) : (
          <ul className="event-list">
            {events.map((e) => {
              const games = e.items.filter((i) => i.type === 'game').length;
              const breaks = e.items.length - games;
              return (
                <li key={e.id} className="event-row">
                  <div>
                    <a className="event-row__name" href={`#/event/${e.id}`}>{e.name}</a>
                    <p className="muted">
                      {games} {games === 1 ? 'game' : 'games'}
                      {breaks > 0 && `, ${breaks} ${breaks === 1 ? 'intermission' : 'intermissions'}`}
                    </p>
                  </div>
                  <div className="row">
                    <button className="btn btn--primary" onClick={() => navigate(`/run/${e.id}`)}>Run event</button>
                    <button className="btn" onClick={() => navigate(`/event/${e.id}`)}>Edit</button>
                    <button className="btn btn--quiet" onClick={() => duplicateEvent(e.id)}>Duplicate</button>
                    <button className="btn btn--quiet" onClick={() => exportEvents([e], eventFilename(e))}>Export</button>
                    <button
                      className="btn btn--quiet btn--danger"
                      onClick={() => confirm(`Delete “${e.name}”? This can't be undone.`) && deleteEvent(e.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="muted backup-note">
          Events are saved in this browser only. Use Export all to keep a backup or to move your events to another computer, then
          Import them there.
        </p>
      </section>
    </main>
  );
}
