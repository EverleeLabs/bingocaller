import { contrast, ensureContrast, readableOn, mix } from './colour.js';

export { contrast };

// Colours, logo and font for an event. The event's `theme` is used on every
// screen of the event (games, intermissions, the end screen), on the TV and
// the caller. It only holds what the host changed; everything else uses the
// standard look below.
//
// theme = {
//   bg, text, accent,            // background, all board text, pattern squares
//   face, faceText,              // ball centre and the number on it
//   button, bingo,               // caller's main buttons; Bingo button and the TV's Bingo/prize banners (text picked for contrast)
//   balls: [{ bg, text }] x 5,   // per column (B I N G O): ball colour, text on that colour
//   image, dim,                  // background picture (id in the picture store), fade 0-90
//   logo, logoSource, logoCrop,  // cropped logo and the uploaded original (picture ids), crop { x, y, w, h } as fractions
//   logoPlace, logoSize,         // a key of LOGO_PLACES, height as % of the screen (LOGO_SIZE.min-max)
//   font,                        // key of FONTS
// }
// Pictures are kept in IndexedDB (src/lib/pictures.js). Backup files, and
// events saved by older versions, carry them as event.images = { [id]: dataUrl }.

export const DEFAULT_THEME = {
  bg: '#221b45',
  text: '#ffffff',
  accent: '#c81f66',
  face: '#ffffff',
  faceText: '#1d1838',
  button: '#c81f66',
  bingo: '#f29d12',
  balls: [
    { bg: '#2f6fdb', text: '#ffffff' },
    { bg: '#e0413a', text: '#ffffff' },
    { bg: '#f1ede2', text: '#1d1838' },
    { bg: '#23985a', text: '#ffffff' },
    { bg: '#f29d12', text: '#1d1838' },
  ],
  dim: 40,
  logoPlace: 'beside',
  logoSize: 12,
  font: 'standard',
};

export const FONTS = {
  standard: { label: 'Standard', family: "'Archivo Variable', 'Archivo', system-ui, sans-serif" },
  readable: { label: 'Extra readable', family: "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif" },
  rounded: { label: 'Rounded', family: "'Fredoka Variable', system-ui, sans-serif" },
  tall: { label: 'Tall', family: "'Oswald Variable', 'Arial Narrow', sans-serif" },
  elegant: { label: 'Elegant', family: "'Playfair Display Variable', Georgia, serif" },
  bold: { label: 'Bold', family: "'Bungee', Impact, sans-serif" },
};

export const LOGO_PLACES = {
  beside: 'Before the event name',
  after: 'After the event name',
  above: 'Above the event name',
  instead: 'Instead of the event name',
  'top-left': 'Top left corner',
  'top-right': 'Top right corner',
  'bottom-left': 'Bottom left corner',
  'bottom-right': 'Bottom right corner',
};
export const isCornerPlace = (place) => /^(top|bottom)-(left|right)$/.test(place);
export const LOGO_SIZE = { min: 4, max: 30 };
const OLD_LOGO_SIZES = { s: 8, m: 12, l: 18 }; // before the size slider

/** Ready-made colour sets. Hosts can save their own too (src/lib/palettes.js). */
export const BUILT_IN_SETS = [
  { id: 'standard', name: 'Standard', theme: {} },
  { id: 'daylight', name: 'Daylight', theme: { bg: '#f4f1e8', text: '#1d1838', accent: '#c81f66', face: '#ffffff', faceText: '#1d1838' } },
  { id: 'high-contrast', name: 'High contrast', theme: { bg: '#000000', text: '#ffffff', accent: '#ffd400', faceText: '#000000', font: 'readable' } },
  {
    id: 'neon',
    name: 'Neon night',
    theme: {
      bg: '#0a0a1f', text: '#f0f0ff', accent: '#00e5ff', font: 'bold',
      balls: [{ bg: '#ff2bd6', text: '#ffffff' }, { bg: '#00c2ff', text: '#0a0a1f' }, { bg: '#f5f5f5', text: '#0a0a1f' }, { bg: '#39ff14', text: '#0a0a1f' }, { bg: '#ffb000', text: '#0a0a1f' }],
    },
  },
  {
    id: 'classic-hall',
    name: 'Classic hall',
    theme: {
      bg: '#5a0f1a', text: '#fbe9c6', accent: '#e2b043', faceText: '#5a0f1a', font: 'elegant',
      balls: [{ bg: '#1f4e8c' }, { bg: '#b0302a' }, { bg: '#efe6cf', text: '#3b0a12' }, { bg: '#2c6e49' }, { bg: '#d99a2b', text: '#3b0a12' }],
    },
  },
];

const COLUMN_VARS = ['--b', '--i', '--n', '--g', '--o'];
export const PICTURE_KEYS = ['image', 'logo', 'logoSource'];
export const COLOUR_KEYS = ['bg', 'text', 'accent', 'face', 'faceText', 'button', 'bingo'];

export const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isImageRef = (v) => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);

/** Keep only valid values. Returns undefined when nothing is set. */
export function cleanTheme(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const t = {};
  for (const k of COLOUR_KEYS) if (isHex(raw[k])) t[k] = raw[k].toLowerCase();
  if (Array.isArray(raw.balls)) {
    const balls = Array.from({ length: 5 }, (_, c) => {
      const b = raw.balls[c] || {};
      const out = {};
      if (isHex(b.bg)) out.bg = b.bg.toLowerCase();
      if (isHex(b.text)) out.text = b.text.toLowerCase();
      return out;
    });
    if (balls.some((b) => b.bg || b.text)) t.balls = balls;
  }
  for (const k of PICTURE_KEYS) if (isImageRef(raw[k])) t[k] = raw[k];
  if (Number.isFinite(raw.dim)) t.dim = Math.round(Math.min(90, Math.max(0, raw.dim)));
  if (raw.logoPlace in LOGO_PLACES) t.logoPlace = raw.logoPlace;
  const size = OLD_LOGO_SIZES[raw.logoSize] ?? raw.logoSize;
  if (Number.isFinite(size)) t.logoSize = Math.round(Math.min(LOGO_SIZE.max, Math.max(LOGO_SIZE.min, size)));
  const crop = cleanCrop(raw.logoCrop);
  if (crop) t.logoCrop = crop;
  if (raw.font in FONTS) t.font = raw.font;
  return Object.keys(t).length ? t : undefined;
}

/** A crop rectangle as fractions of the picture, or undefined if it isn't one. */
export function cleanCrop(c) {
  if (!c || ![c.x, c.y, c.w, c.h].every(Number.isFinite)) return undefined;
  const r = (n) => Math.round(n * 10000) / 10000;
  const x = Math.min(0.99, Math.max(0, c.x));
  const y = Math.min(0.99, Math.max(0, c.y));
  return { x: r(x), y: r(y), w: r(Math.min(1 - x, Math.max(0.01, c.w))), h: r(Math.min(1 - y, Math.max(0.01, c.h))) };
}

/** Move or resize a crop by dx, dy (fractions), keeping it inside the picture. */
export function resizeCrop(r, mode, dx, dy) {
  const MIN = 0.04; // smallest crop, as a fraction of the picture
  if (mode === 'move') {
    return { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) };
  }
  let { x, y, w, h } = r;
  const right = x + w;
  const bottom = y + h;
  if (mode.includes('w')) x = clamp(x + dx, 0, right - MIN);
  if (mode.includes('e')) w = clamp(w + dx, MIN, 1 - x);
  if (mode.includes('n')) y = clamp(y + dy, 0, bottom - MIN);
  if (mode.includes('s')) h = clamp(h + dy, MIN, 1 - y);
  if (mode.includes('w')) w = right - x;
  if (mode.includes('n')) h = bottom - y;
  return { x, y, w, h };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** The picture data a theme points at: { image, logo, logoSource } (null when none). */
export function themePictures(theme, images) {
  const get = (id) => (id ? images?.[id] ?? null : null);
  return { image: get(theme?.image), logo: get(theme?.logo), logoSource: get(theme?.logoSource) };
}

/** Drop pictures nothing uses any more. */
export function pruneImages(images, theme) {
  const used = new Set(PICTURE_KEYS.map((k) => theme?.[k]).filter(Boolean));
  const kept = Object.fromEntries(Object.entries(images || {}).filter(([id]) => used.has(id)));
  return Object.keys(kept).length ? kept : undefined;
}

/**
 * Give a theme's pictures new ids from `newId()`. Returns { theme, images }
 * with only the pictures the theme uses; references to missing ones are dropped.
 */
export function renamePictures(theme, images, newId) {
  if (!theme) return { theme, images: {} };
  const t = { ...theme };
  const out = {};
  const renamed = {};
  for (const k of PICTURE_KEYS) {
    const data = t[k] && images?.[t[k]];
    if (!data) {
      delete t[k];
      continue;
    }
    renamed[t[k]] ??= newId();
    out[renamed[t[k]]] = data;
    t[k] = renamed[t[k]];
  }
  if (!t.logoSource) delete t.logoCrop;
  return { theme: cleanTheme(t), images: out };
}

/** CSS custom properties for a theme, to set as an inline style. */
export function themeStyle(theme, image) {
  const t = theme || {};
  const s = {};
  if (t.bg) {
    s['--tv-bg'] = t.bg;
    s['--tv-bg-2'] = `color-mix(in srgb, ${t.bg} 85%, #fff)`;
  }
  if (t.text) s['--tv-text'] = t.text;
  if (t.accent) s['--tv-accent'] = t.accent;
  if (t.face) s['--ball-face'] = t.face;
  if (t.faceText) {
    s['--ball-num'] = t.faceText;
    s['--ball-letter'] = `color-mix(in srgb, ${t.faceText} 70%, ${t.face || DEFAULT_THEME.face})`;
  }
  (t.balls || []).forEach((b, c) => {
    if (b.bg) s[COLUMN_VARS[c]] = b.bg;
    if (b.text) s[`${COLUMN_VARS[c]}-ink`] = b.text;
  });
  if (t.button) {
    s['--btn'] = t.button;
    s['--btn-ink'] = readableOn(t.button);
    s['--btn-line'] = ensureContrast(t.button, '#ffffff', 3); // outline buttons sit on white
  }
  if (t.bingo) {
    s['--bingo'] = t.bingo;
    s['--bingo-ink'] = readableOn(t.bingo);
  }
  if (t.font && t.font !== 'standard' && FONTS[t.font]) s['--tv-font'] = FONTS[t.font].family;
  if (image) {
    s['--tv-image'] = `url("${image}")`;
    s['--tv-veil'] = `color-mix(in srgb, ${t.bg || DEFAULT_THEME.bg} ${t.dim ?? DEFAULT_THEME.dim}%, transparent)`;
  }
  return s;
}

/** Does the theme change the background or text? (The caller then shows its board in those colours.) */
export const hasSurface = (theme) => !!(theme?.bg || theme?.text || theme?.image);

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

/**
 * The colours the board's text actually sits on. With a picture, that's the
 * picture's darkest and lightest areas seen through the fade (`stats` from
 * analysePicture); otherwise just the background colour.
 */
export function visibleBackgrounds(theme, stats, dim = theme?.dim ?? DEFAULT_THEME.dim) {
  const bg = theme?.bg || DEFAULT_THEME.bg;
  if (!theme?.image || !stats) return [bg];
  return [stats.dark, stats.average, stats.light].map((c) => mix(c, bg, dim / 100));
}

/** `fg` adjusted until it has `min` contrast with every one of `backgrounds`. */
export function standOut(fg, backgrounds, min) {
  let c = fg;
  for (let i = 0; i < 4; i++) {
    const worst = backgrounds.reduce((w, b) => (contrast(c, b) < contrast(c, w) ? b : w));
    if (contrast(c, worst) >= min) break;
    c = ensureContrast(c, worst, min);
  }
  return c;
}

/** The lowest contrast between `fg` and any of `backgrounds`. */
export const worstContrast = (fg, backgrounds) => Math.min(...backgrounds.map((b) => contrast(fg, b)));

/** The least fade (in steps of 5) that makes `text` readable over the picture, or null if even 90% isn't enough. */
export function fadeNeeded(theme, stats, text, min = 4.5) {
  for (let dim = 0; dim <= 90; dim += 5) if (worstContrast(text, visibleBackgrounds(theme, stats, dim)) >= min) return dim;
  return null;
}

/**
 * Plain-language warnings for colours that will be hard to read on a TV, each
 * with a one-click fix: [{ message, fix: { label, patch } }]. Text needs 4.5:1
 * contrast and big bold numbers 3:1. Pattern squares are large solid blocks,
 * so they're only flagged below 2.5:1 (the standard magenta is 2.9:1).
 */
export function themeWarnings(theme, stats) {
  const t = theme || {};
  const d = DEFAULT_THEME;
  const out = [];
  const bg = t.bg || d.bg;
  const text = t.text || d.text;
  const backgrounds = visibleBackgrounds(t, stats);
  if (worstContrast(text, backgrounds) < 4.5) {
    const fade = t.image && stats ? fadeNeeded(t, stats, text) : null;
    out.push({
      message: t.image ? 'Some of the text is hard to read over the picture.' : 'The text is hard to read on the background colour.',
      fix: fade != null
        ? { label: `Fade the picture to ${fade}%`, patch: { dim: fade } }
        : { label: 'Use a readable text colour', patch: { text: ensureContrast(text, t.image ? mix(stats?.average || bg, bg, (t.dim ?? d.dim) / 100) : bg, 7) } },
    });
  }
  const accent = t.accent || d.accent;
  if (worstContrast(accent, backgrounds) < 2.5) {
    out.push({ message: 'The pattern squares are hard to see on the background.', fix: { label: 'Make them stand out', patch: { accent: standOut(accent, backgrounds, 3.5) } } });
  }
  const face = t.face || d.face;
  const faceText = t.faceText || d.faceText;
  if (contrast(faceText, face) < 4.5) {
    out.push({ message: 'The number on the ball is hard to read on the ball centre.', fix: { label: 'Fix the number colour', patch: { faceText: ensureContrast(faceText, face, 7) } } });
  }
  const balls = d.balls.map((b, c) => ({ bg: t.balls?.[c]?.bg || b.bg, text: t.balls?.[c]?.text || b.text }));
  const cols = LETTERS.filter((_, c) => contrast(balls[c].text, balls[c].bg) < 3);
  if (cols.length) {
    out.push({
      message: `Called numbers in ${cols.join(', ')} are hard to read on ${cols.length === 1 ? 'that ball colour' : 'those ball colours'}.`,
      fix: { label: 'Fix the text on the balls', patch: { balls: balls.map((b, c) => (cols.includes(LETTERS[c]) ? { ...t.balls?.[c], text: readableOn(b.bg) } : { ...t.balls?.[c] })) } },
    });
  }
  return out;
}

/** Load a File or a data URL as an image. */
export function loadPicture(source) {
  return new Promise((resolve, reject) => {
    const isFile = typeof source !== 'string';
    const url = isFile ? URL.createObjectURL(source) : source;
    const img = new Image();
    img.onload = () => {
      if (isFile) URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (isFile) URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be opened as a picture. Try a JPG or PNG."));
    };
    img.src = url;
  });
}

function draw(img, scale, fill) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const ctx = canvas.getContext('2d');
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Shrink a background picture so it covers a 1920x1080 screen and save it as
 * a JPEG data URL. Keeps events small enough to store in the browser.
 */
export async function shrinkImage(file, fill = DEFAULT_THEME.bg) {
  const img = await loadPicture(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = draw(img, Math.min(1, Math.max(1920 / w, 1080 / h)), fill); // fill: transparent parts of a PNG
  let data = canvas.toDataURL('image/jpeg', 0.8);
  if (data.length > 1_200_000) data = canvas.toDataURL('image/jpeg', 0.6);
  return data;
}

/** Keeps transparency: WebP, or PNG where the browser can't make WebP. */
function toLogoData(canvas) {
  const webp = canvas.toDataURL('image/webp', 0.9);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

/** The uploaded logo, shrunk to at most 1600px. Kept so the logo can be cropped again later. */
export async function shrinkLogo(file) {
  const img = await loadPicture(file);
  const w = img.naturalWidth || img.width || 1600;
  const h = img.naturalHeight || img.height || 1600;
  return toLogoData(draw(img, Math.min(1, 1600 / Math.max(w, h))));
}

/** Cut `crop` (fractions) out of a logo, at most 800px on its longest side. */
export async function cropLogo(src, crop) {
  const img = await loadPicture(src);
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const sx = crop.x * W;
  const sy = crop.y * H;
  const sw = Math.max(1, crop.w * W);
  const sh = Math.max(1, crop.h * H);
  const scale = Math.min(1, 800 / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return toLogoData(canvas);
}

/**
 * The part of a logo that isn't empty border, as a crop (fractions). Empty
 * means see-through, or the same colour as the corners for a logo on a solid
 * background. Returns the whole picture if nothing can be trimmed.
 */
export async function trimBounds(src) {
  const full = { x: 0, y: 0, w: 1, h: 1 };
  const img = await loadPicture(src);
  const scale = Math.min(1, 400 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)); // a smaller copy is plenty to find edges
  const canvas = draw(img, scale);
  const { width: w, height: h } = canvas;
  let data;
  try {
    data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  } catch {
    return full;
  }
  const at = (x, y) => data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4);
  const corner = at(0, 0);
  const seeThrough = corner[3] < 16;
  const empty = (p) => (seeThrough ? p[3] < 16 : p[3] > 200 && Math.abs(p[0] - corner[0]) + Math.abs(p[1] - corner[1]) + Math.abs(p[2] - corner[2]) < 36);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (empty(at(x, y))) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return full;
  const pad = 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  return cleanCrop({ x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h });
}
