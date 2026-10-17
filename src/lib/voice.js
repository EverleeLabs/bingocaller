import { useEffect, useState, useSyncExternalStore } from 'react';
import { letterOf } from './patterns.js';

// Spoken calls use the browser's built-in text-to-speech (Web Speech API):
// no audio files, no service, works offline. Sound plays through whatever
// output the computer is using, so AirPlay to the TV carries it too.

const KEY = 'bingo.audio.v1';
const DEFAULTS = {
  enabled: true,
  voiceURI: '',      // '' = the browser's default voice
  rate: 0.9,         // a touch slower than normal reads better in a hall
  volume: 1,
  repeat: true,      // "B 7 … B 7"
  digits: true,      // "G 52 … five two"
  digitPause: 2000,  // ms of silence before the digits
  chime: true,       // short ding before each call
  announce: true,    // game starts, bingo calls, game over
};

const listeners = new Set();
let settings = load();

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setAudio(patch) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
  if (patch.enabled === false) stopSpeaking();
}

export const useAudioSettings = () =>
  useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => settings);

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** English voices, best-sounding first where we can tell. */
export function useVoices() {
  const [voices, setVoices] = useState(() => (speechSupported ? speechSynthesis.getVoices() : []));
  useEffect(() => {
    if (!speechSupported) return;
    const update = () => setVoices(speechSynthesis.getVoices());
    update();
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  const score = (v) => (/premium|enhanced|natural|neural|google/i.test(v.name) ? 0 : 1) + (v.localService ? 0 : 0.5);
  return (english.length ? english : voices).slice().sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

/**
 * A call split where a real pause goes: the number, then (after a gap) the
 * digits and any repeat. e.g. ["G, 52.", "five, two. ... G, 52."]
 */
export function callParts(n, { repeat, digits }) {
  const letter = letterOf(n);
  const parts = [`${letter}, ${n}.`];
  if (digits && n >= 10) parts.push(`${String(n).split('').map(digitWord).join(', ')}.`);
  if (repeat) parts[parts.length - 1] += ` ... ${letter}, ${n}.`;
  return parts;
}

/** The words for a call, e.g. "B, 7." or "G, 52. Five, two." */
export const callWords = (n, s) => callParts(n, s).join(' ');

// Choices for the silence between the number and its digits. A "..." in the
// text only gives a short breath, so the digits are a separate utterance.
export const DIGIT_PAUSES = [
  { ms: 1000, label: 'Short (1 second)' },
  { ms: 2000, label: 'Medium (2 seconds)' },
  { ms: 3000, label: 'Long (3 seconds)' },
];

const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const digitWord = (d) => DIGITS[Number(d)];

// True while a call is paused between its number and its digits, so the
// caller still counts it as speaking and doesn't start the next number.
let midCall = false;

export function isSpeaking() {
  return speechSupported && (midCall || speechSynthesis.speaking || speechSynthesis.pending);
}

export function stopSpeaking() {
  speechSeq++; // drop any digits still waiting to be read
  midCall = false;
  if (speechSupported) speechSynthesis.cancel();
}

// Bumped on every new announcement, so a number call still waiting for its
// chime never talks over something said after it (e.g. "Bingo!").
let speechSeq = 0;

/** Speak text with the saved voice settings. */
export function say(text, s = settings) {
  speechSeq++;
  midCall = false;
  speak(text, s);
}

function speak(text, s) {
  if (!speechSupported || !s.enabled) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = speechSynthesis.getVoices().find((v) => v.voiceURI === s.voiceURI);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = 'en-US';
  }
  u.rate = s.rate;
  u.volume = s.volume;
  speechSynthesis.speak(u);
  // Chrome stops long queues after ~15s unless nudged; calls are short, but be safe.
  speechSynthesis.resume();
}

/** Speak a call. `after` is extra text read straight after it (e.g. "That's 50 numbers."). */
export async function announceNumber(n, s = settings, after = '') {
  if (!s.enabled) return;
  const mine = ++speechSeq;
  if (s.chime) await chime(s.volume);
  if (mine !== speechSeq) return; // something newer was said during the chime
  const parts = callParts(n, s);
  if (after) parts[parts.length - 1] += ` ... ${after}`;
  midCall = parts.length > 1;
  speak(parts[0], s);
  for (const part of parts.slice(1)) {
    await speechDone();
    if (mine !== speechSeq) return;
    await new Promise((r) => setTimeout(r, s.digitPause ?? DEFAULTS.digitPause));
    if (mine !== speechSeq) return;
    speak(part, s);
  }
  midCall = false;
}

/** Resolves once the speech engine has gone quiet. */
async function speechDone() {
  // Polling is more reliable than an utterance's onend, which Safari can skip.
  await new Promise((r) => setTimeout(r, 250));
  while (speechSynthesis.speaking || speechSynthesis.pending) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

let ctx;
/** A soft two-tone ding, like a ball dropping. Resolves when it's done. */
export function chime(volume = 1) {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25 * volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    return new Promise((r) => setTimeout(r, 450));
  } catch {
    return Promise.resolve();
  }
}

/**
 * Browsers only allow sound after the person clicks something. Call this from
 * a click handler (e.g. "Start calling") so later automatic calls can speak.
 */
export function unlockAudio() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
  } catch {
    /* ignore */
  }
  if (speechSupported) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}
