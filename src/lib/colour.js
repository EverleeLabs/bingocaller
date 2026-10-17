// Colour maths for #rrggbb colours: mixing, HSL, contrast and readable text.

export const INK = '#1d1838'; // the app's dark text colour

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const toHex = (rgb) => `#${rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;

/** `a` with `t` (0-1) of `b` mixed in. */
export function mix(a, b, t) {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** [hue 0-360, saturation 0-100, lightness 0-100] */
export function toHsl(hex) {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

export function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0), f(8), f(4)].map((v) => v * 255));
}

export function luminance(hex) {
  const [r, g, b] = toRgb(hex)
    .map((v) => v / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1 to 21). 4.5 is comfortable for text, 3 for big bold text. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or dark ink, whichever reads better on `bg`. */
export const readableOn = (bg) => (contrast('#ffffff', bg) >= contrast(INK, bg) ? '#ffffff' : INK);

/**
 * `fg`, made lighter or darker (keeping its hue) until it has at least `min`
 * contrast with `bg`. Falls back to black or white if no shade of it is enough.
 */
export function ensureContrast(fg, bg, min = 4.5) {
  if (contrast(fg, bg) >= min) return fg;
  const [h, s, l] = toHsl(fg);
  const darker = contrast('#000000', bg) > contrast('#ffffff', bg);
  for (let step = 1; step <= 50; step++) {
    const next = fromHsl(h, s, darker ? l - step * 2 : l + step * 2);
    if (contrast(next, bg) >= min) return next;
  }
  return contrast('#000000', bg) > contrast('#ffffff', bg) ? '#000000' : '#ffffff';
}
