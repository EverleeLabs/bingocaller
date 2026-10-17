// Colours, logo and font for an event. The event's `theme` is used on every
// screen of the event (games, intermissions, the end screen), on the TV and
// the caller. It only holds what the host changed; everything else uses the
// standard look below.
//
// theme = {
//   bg, text, accent,            // background, all board text, pattern squares
//   face, faceText,              // ball centre and the number on it
//   balls: [{ bg, text }] x 5,   // per column (B I N G O): ball colour, text on that colour
//   image, dim,                  // background picture (id into event.images), fade 0-90
//   logo, logoPlace, logoSize,   // logo picture (id into event.images), 'beside' | 'instead' of the event name, 's' | 'm' | 'l'
//   font,                        // key of FONTS
// }
// Pictures are stored next to the theme in event.images = { [id]: dataUrl }.

export const DEFAULT_THEME = {
  bg: '#221b45',
  text: '#ffffff',
  accent: '#c81f66',
  face: '#ffffff',
  faceText: '#1d1838',
  balls: [
    { bg: '#2f6fdb', text: '#ffffff' },
    { bg: '#e0413a', text: '#ffffff' },
    { bg: '#f1ede2', text: '#1d1838' },
    { bg: '#23985a', text: '#ffffff' },
    { bg: '#f29d12', text: '#1d1838' },
  ],
  dim: 40,
  logoPlace: 'beside',
  logoSize: 'm',
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

export const LOGO_PLACES = { beside: 'Next to the event name', instead: 'Instead of the event name' };
export const LOGO_SIZES = { s: 'Small', m: 'Medium', l: 'Large' };

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
const PICTURE_KEYS = ['image', 'logo'];

export const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isImageRef = (v) => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);

/** Keep only valid values. Returns undefined when nothing is set. */
export function cleanTheme(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const t = {};
  for (const k of ['bg', 'text', 'accent', 'face', 'faceText']) if (isHex(raw[k])) t[k] = raw[k].toLowerCase();
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
  if (raw.logoSize in LOGO_SIZES) t.logoSize = raw.logoSize;
  if (raw.font in FONTS) t.font = raw.font;
  return Object.keys(t).length ? t : undefined;
}

/** The picture data a theme points at: { image, logo } (null when none). */
export function themePictures(theme, images) {
  const get = (id) => (id ? images?.[id] ?? null : null);
  return { image: get(theme?.image), logo: get(theme?.logo) };
}

/** Drop pictures nothing uses any more. */
export function pruneImages(images, theme) {
  const used = new Set(PICTURE_KEYS.map((k) => theme?.[k]).filter(Boolean));
  const kept = Object.fromEntries(Object.entries(images || {}).filter(([id]) => used.has(id)));
  return Object.keys(kept).length ? kept : undefined;
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
  if (t.font && t.font !== 'standard' && FONTS[t.font]) s['--tv-font'] = FONTS[t.font].family;
  if (image) {
    s['--tv-image'] = `url("${image}")`;
    s['--tv-veil'] = `color-mix(in srgb, ${t.bg || DEFAULT_THEME.bg} ${t.dim ?? DEFAULT_THEME.dim}%, transparent)`;
  }
  return s;
}

/** Does the theme change the background or text? (The caller then shows its board in those colours.) */
export const hasSurface = (theme) => !!(theme?.bg || theme?.text || theme?.image);

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

/** Plain-language warnings for colour pairs that will be hard to read on a TV. */
export function themeWarnings(theme) {
  const t = theme || {};
  const d = DEFAULT_THEME;
  const out = [];
  const hard = (a, b) => contrast(a, b) < 3;
  if (hard(t.text || d.text, t.bg || d.bg)) out.push(t.image ? 'The text is hard to read on the background colour, which tints the picture.' : 'The text is hard to read on the background colour.');
  if (hard(t.faceText || d.faceText, t.face || d.face)) out.push('The number on the ball is hard to read on the ball centre.');
  const cols = LETTERS.filter((_, c) => hard(t.balls?.[c]?.text || d.balls[c].text, t.balls?.[c]?.bg || d.balls[c].bg));
  if (cols.length) out.push(`Called numbers in ${cols.join(', ')} are hard to read on ${cols.length === 1 ? 'that ball colour' : 'those ball colours'}.`);
  return out;
}

function loadPicture(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
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

/** Shrink a logo to at most 800px, keeping transparency (WebP, or PNG where WebP can't be made). */
export async function shrinkLogo(file) {
  const img = await loadPicture(file);
  const w = img.naturalWidth || img.width || 800;
  const h = img.naturalHeight || img.height || 800;
  const canvas = draw(img, Math.min(1, 800 / Math.max(w, h)));
  const webp = canvas.toDataURL('image/webp', 0.9);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}
