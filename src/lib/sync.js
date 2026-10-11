import { useEffect, useState } from 'react';

// The caller publishes a "screen" snapshot; the TV display renders it.
// Same browser, different window: BroadcastChannel delivers it instantly and
// localStorage lets a freshly opened display pick up the latest snapshot.
// To support separate devices later, replace publish/subscribe with a
// realtime service (e.g. a WebSocket) without touching the display page.

const CHANNEL = 'bingo-display';
const KEY = 'bingo.screen.v1';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

export function publishScreen(screen) {
  const msg = { ...screen, sentAt: Date.now() };
  channel?.postMessage(msg);
  try {
    localStorage.setItem(KEY, JSON.stringify(msg));
  } catch {
    /* ignore */
  }
}

export function readScreen() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function useScreen() {
  const [screen, setScreen] = useState(readScreen);
  useEffect(() => {
    const onMsg = (e) => setScreen(e.data);
    const onStorage = (e) => e.key === KEY && setScreen(readScreen());
    channel?.addEventListener('message', onMsg);
    window.addEventListener('storage', onStorage);
    return () => {
      channel?.removeEventListener('message', onMsg);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return screen;
}

/** Re-render every `ms` so countdowns tick. */
export function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * Like useNow, but ticks from a Web Worker. Browsers heavily slow down timers
 * in background windows; worker timers keep the auto-caller on schedule even
 * when the caller's window is behind the TV window or minimised.
 */
export function useWorkerNow(ms = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let worker;
    let fallback;
    try {
      const src = `setInterval(() => postMessage(0), ${ms});`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = () => setNow(Date.now());
    } catch {
      fallback = setInterval(() => setNow(Date.now()), ms);
    }
    return () => {
      worker?.terminate();
      clearInterval(fallback);
    };
  }, [ms]);
  return now;
}

export function openDisplayWindow() {
  const url = `${location.origin}${location.pathname}#/display`;
  return window.open(url, 'bingo-display', 'popup,width=1280,height=720');
}
