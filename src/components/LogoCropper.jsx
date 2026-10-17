import { useEffect, useRef, useState } from 'react';
import { trimBounds, resizeCrop } from '../lib/theme.js';

const FULL = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Crop a logo: drag the box to move it, drag a corner or edge to resize it,
 * or use Trim empty edges. Arrow keys move the box (Shift+arrows resize).
 * `crop` and the result are fractions of the picture: { x, y, w, h }.
 */
export default function LogoCropper({ src, crop, onCancel, onSave }) {
  const dialogRef = useRef(null);
  const stageRef = useRef(null);
  const drag = useRef(null);
  const [rect, setRect] = useState(crop || FULL);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    d?.showModal?.();
    return () => d?.close?.();
  }, []);

  const trim = async () => setRect(await trimBounds(src));

  const start = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = stageRef.current.getBoundingClientRect();
    drag.current = { mode, x: e.clientX, y: e.clientY, rect, box };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.box.width;
    const dy = (e.clientY - d.y) / d.box.height;
    setRect(resizeCrop(d.rect, d.mode, dx, dy));
  };
  const end = () => (drag.current = null);

  const onKey = (e) => {
    const step = 0.01;
    const keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!keys[e.key]) return;
    e.preventDefault();
    const [dx, dy] = keys[e.key];
    setRect((r) => resizeCrop(r, e.shiftKey ? 'se' : 'move', dx, dy));
  };

  const save = async () => {
    setBusy(true);
    await onSave(rect);
    setBusy(false);
  };

  const pct = (n) => `${n * 100}%`;
  return (
    <dialog ref={dialogRef} className="cropper" onCancel={(e) => (e.preventDefault(), onCancel())} aria-labelledby="cropper-title">
      <h2 id="cropper-title">Crop the logo</h2>
      <p className="muted">Drag the box or its corners to choose the part of the picture to show.</p>
      <div className="cropper__stage" ref={stageRef} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <img src={src} alt="" draggable={false} />
        <div className="cropper__shade" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pct(rect.x)} ${pct(rect.y)}, ${pct(rect.x)} ${pct(rect.y + rect.h)}, ${pct(rect.x + rect.w)} ${pct(rect.y + rect.h)}, ${pct(rect.x + rect.w)} ${pct(rect.y)}, ${pct(rect.x)} ${pct(rect.y)})` }} />
        <div
          className="cropper__box"
          style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
          onPointerDown={start('move')}
          onKeyDown={onKey}
          tabIndex={0}
          role="slider"
          aria-label="Crop area. Arrow keys move it, Shift and arrow keys resize it."
          aria-valuetext={`${Math.round(rect.w * 100)}% wide, ${Math.round(rect.h * 100)}% tall`}
        >
          {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => (
            <span key={h} className={`cropper__handle cropper__handle--${h}`} onPointerDown={start(h)} />
          ))}
        </div>
      </div>
      <div className="row row--between">
        <div className="row">
          <button type="button" className="btn btn--quiet" onClick={trim}>Trim empty edges</button>
          <button type="button" className="btn btn--quiet" onClick={() => setRect(FULL)}>Whole picture</button>
        </div>
        <div className="row">
          <button type="button" className="btn btn--quiet" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Use this crop'}</button>
        </div>
      </div>
    </dialog>
  );
}
