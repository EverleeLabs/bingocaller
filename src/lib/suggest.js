// Colour suggestions that go with the event's background colour or picture.
// Every suggestion is built to pass the readability checks in theme.js.

import { contrast, ensureContrast, readableOn, toHsl, fromHsl, luminance } from './colour.js';
import { DEFAULT_THEME, visibleBackgrounds, fadeNeeded, standOut, loadPicture } from './theme.js';

// Traditional ball hues for B I N G O (N is a light neutral).
const CLASSIC_HUES = [218, 3, null, 145, 37];

/**
 * Up to three complete colour suggestions: [{ id, name, patch }]. `patch`
 * sets every colour (and, for a picture, the background colour and fade).
 * `stats` comes from analysePicture when the event has a background picture.
 */
export function suggestThemes(theme, stats) {
  const t = theme || {};
  const picture = !!(t.image && stats);
  // With a picture, the background colour becomes a deep shade of the picture's main colour.
  const bg = picture ? deepen(stats.palette[0] || stats.average, luminance(stats.average) > 0.4) : t.bg || DEFAULT_THEME.bg;
  const [h, s] = toHsl(bg);
  const dark = luminance(bg) < 0.3;
  const hues = distinctHues(picture ? stats.palette.map((c) => toHsl(c)[0]) : [h + 180, h + 120, h + 240, h + 60], 4);

  const base = (accentHue) => {
    const text = dark ? fromHsl(h, Math.min(s, 30), 96) : fromHsl(h, Math.min(s, 45), 12);
    return {
      bg,
      text: ensureContrast(text, bg, 7),
      accent: ensureContrast(fromHsl(accentHue, 85, dark ? 60 : 42), bg, 3.5),
      face: fromHsl(h, 25, 98),
      faceText: ensureContrast(fromHsl(h, 50, 14), fromHsl(h, 25, 98), 7),
      button: ensureContrast(fromHsl(accentHue, 75, 42), '#ffffff', 3),
      bingo: fromHsl(42, 95, 55),
    };
  };
  const ballSet = (colours) => colours.map((c) => {
    const text = readableOn(c);
    const ball = ensureContrast(c, text, 4.5);
    return { bg: ball, text };
  });
  const neutral = fromHsl(h, 25, 92);

  const matching = {
    ...base(hues[0]),
    balls: ballSet([hues[0], hues[1], null, hues[2], hues[3]].map((hue) => (hue == null ? neutral : fromHsl(hue, 70, 50)))),
  };
  const classic = {
    ...base(h + 180),
    balls: ballSet(CLASSIC_HUES.map((hue) => (hue == null ? neutral : fromHsl(hue, dark ? 72 : 78, dark ? 52 : 44)))),
  };
  const tonal = {
    ...base(h),
    balls: ballSet([30, 42, 90, 54, 66].map((l, i) => (i === 2 ? neutral : fromHsl(h + (i - 2) * 12, Math.max(35, Math.min(s, 70)), l)))),
  };

  const withFade = (patch) => {
    if (!picture) return patch;
    const fade = fadeNeeded({ ...t, bg: patch.bg }, stats, patch.text, 7) ?? 90;
    const dim = Math.max(t.dim ?? DEFAULT_THEME.dim, fade);
    return { ...patch, dim, accent: standOut(patch.accent, visibleBackgrounds({ ...t, bg: patch.bg }, stats, dim), 3.5) };
  };
  return [
    { id: 'matching', name: picture ? 'From your picture' : 'Matching', patch: withFade(matching) },
    { id: 'classic', name: 'Classic balls', patch: withFade(classic) },
    { id: 'tonal', name: 'Tonal', patch: withFade(tonal) },
  ];
}

const hueGap = (a, b) => Math.min(Math.abs(a - b) % 360, 360 - (Math.abs(a - b) % 360));

/**
 * `n` hues that are easy to tell apart (at least 40° from each other),
 * starting from `seeds` in order and filling in with the hues furthest from
 * those already picked.
 */
export function distinctHues(seeds, n) {
  const out = [];
  for (const h of seeds.map((x) => ((x % 360) + 360) % 360)) if (out.length < n && out.every((o) => hueGap(o, h) >= 40)) out.push(h);
  while (out.length < n) {
    let best = 0;
    let bestGap = -1;
    for (let h = 0; h < 360; h += 5) {
      const gap = out.length ? Math.min(...out.map((o) => hueGap(o, h))) : 360;
      if (gap > bestGap) [best, bestGap] = [h, gap];
    }
    out.push(best);
  }
  return out;
}

/** A deep (or, for a light picture, pale) version of a colour, good behind board text. */
function deepen(colour, light) {
  const [h, s] = toHsl(colour);
  return light ? fromHsl(h, Math.min(s, 40), 94) : fromHsl(h, Math.min(s, 60), 14);
}

/**
 * Look at a picture: its average colour, the average of its darkest and
 * lightest tenth, and its main colours (most common first, similar ones merged).
 */
export async function analysePicture(src) {
  const img = await loadPicture(src);
  const w = 64;
  const h = Math.max(1, Math.round((64 * (img.naturalHeight || 1)) / (img.naturalWidth || 1)));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) pixels.push([data[i], data[i + 1], data[i + 2]]);
  return pictureStats(pixels);
}

/** The maths behind analysePicture, on [[r, g, b], ...]. */
export function pictureStats(pixels) {
  const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const avg = (list) => hex([0, 1, 2].map((k) => list.reduce((sum, p) => sum + p[k], 0) / list.length));
  const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  const sorted = [...pixels].sort((a, b) => lum(a) - lum(b));
  const tenth = Math.max(1, Math.floor(sorted.length / 10));

  // Group into coarse colour buckets, then keep the biggest distinct, not-too-grey ones.
  const buckets = new Map();
  for (const p of pixels) {
    const key = p.map((v) => v >> 5).join(',');
    const b = buckets.get(key) || { n: 0, sum: [0, 0, 0] };
    b.n++;
    p.forEach((v, k) => (b.sum[k] += v));
    buckets.set(key, b);
  }
  const palette = [];
  for (const b of [...buckets.values()].sort((x, y) => y.n - x.n)) {
    const c = hex(b.sum.map((v) => v / b.n));
    const [, s, l] = toHsl(c);
    if (s < 18 || l < 8 || l > 94) continue;
    if (palette.some((p) => contrast(p, c) < 1.25 && Math.abs(toHsl(p)[0] - toHsl(c)[0]) < 25)) continue;
    palette.push(c);
    if (palette.length === 6) break;
  }
  return { average: avg(pixels), dark: avg(sorted.slice(0, tenth)), light: avg(sorted.slice(-tenth)), palette };
}

