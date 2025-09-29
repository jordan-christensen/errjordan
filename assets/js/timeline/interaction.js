// interaction.js — optional helpers to attach zoom/pan/brush to a canvas using core API
import { zoomAroundPixel } from "./state";
import { invScaleX, clamp } from "./geometry";

export function attachWheelZoom(canvas, core) {
  const handler = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const delta = Math.abs(ev.deltaY) > 0 ? ev.deltaY : ev.deltaX;
    const zoom = Math.exp(-delta * 0.0015);
    const st = core.getState();
    const next = zoomAroundPixel(st, zoom, mx, rect.width);
    core.setView(next);
    ev.preventDefault();
  };
  canvas.addEventListener("wheel", handler, { passive: false });
  return () => canvas.removeEventListener("wheel", handler);
}

export function attachDragPan(canvas, core) {
  let panning = false,
    panX = 0,
    base = null;
  const down = (e) => {
    panning = true;
    panX = e.clientX;
    base = { ...core.getState().view };
  };
  const move = (e) => {
    if (!panning) return;
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - panX;
    const st = core.getState();
    const span = base.end - base.start;
    const dt = span * (dx / rect.width);
    core.setView({ start: base.start - dt, end: base.end - dt });
  };
  const up = () => {
    panning = false;
  };
  canvas.addEventListener("mousedown", down);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  return () => {
    canvas.removeEventListener("mousedown", down);
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
  };
}

// --- New: minimap brush (create/move/resize) ---
export function attachMinimapBrush(minimap, core) {
  const EDGE = 8; // px near handles counts as resize
  const MIN_W = 10; // minimum brush width in px

  let brushing = false;
  let mode = null; // 'left' | 'right' | 'move' | 'create'
  let downX = 0;
  let baseBx0 = 0,
    baseBx1 = 0; // pixel baselines for move/resize
  let createStart = 0,
    createEnd = 0;

  function getBrushPx(rect, state) {
    const { start, end } = state.view;
    const { start: ds, end: de } = state.dataExtent;
    const x0 = ((start - ds) / Math.max(1, de - ds)) * rect.width;
    const x1 = ((end - ds) / Math.max(1, de - ds)) * rect.width;
    return [x0, x1];
  }

  function commitFromPx(rect, px0, px1, state) {
    const ds = state.dataExtent.start,
      de = state.dataExtent.end;
    const bx0 = clamp(px0, 0, rect.width - MIN_W);
    const bx1 = clamp(px1, bx0 + MIN_W, rect.width);
    const ns = invScaleX(bx0, ds, de, 0, rect.width);
    const ne = invScaleX(bx1, ds, de, 0, rect.width);
    core.setView({ start: ns, end: ne });
  }

  const onDown = (e) => {
    const rect = minimap.getBoundingClientRect();
    const st = core.getState();
    const [bx0, bx1] = getBrushPx(rect, st);
    downX = e.clientX;
    mode = null;

    // pick mode
    if (Math.abs(e.clientX - (rect.left + bx0)) <= EDGE) {
      mode = "left";
    } else if (Math.abs(e.clientX - (rect.left + bx1)) <= EDGE) {
      mode = "right";
    } else if (e.clientX >= rect.left + bx0 && e.clientX <= rect.left + bx1) {
      mode = "move";
    } else {
      mode = "create";
      createStart = e.clientX;
      createEnd = e.clientX;
    }

    baseBx0 = bx0;
    baseBx1 = bx1;
    brushing = true;
    minimap.setPointerCapture?.(e.pointerId);

    if (mode === "create") {
      commitFromPx(rect, createStart - rect.left, createEnd - rect.left, st);
    }

    e.preventDefault();
  };

  const onMove = (e) => {
    const rect = minimap.getBoundingClientRect();
    const st = core.getState();
    if (!brushing) {
      // hover cursor
      const [bx0, bx1] = getBrushPx(rect, st);
      const x = e.clientX - rect.left;
      if (Math.abs(x - bx0) <= EDGE || Math.abs(x - bx1) <= EDGE) {
        minimap.style.cursor = "ew-resize";
      } else if (x > bx0 && x < bx1) {
        minimap.style.cursor = "grab";
      } else {
        minimap.style.cursor = "crosshair";
      }
      return;
    }

    if (mode === "left") {
      const nx0 = clamp(e.clientX - rect.left, 0, baseBx1 - MIN_W);
      commitFromPx(rect, nx0, baseBx1, st);
    } else if (mode === "right") {
      const nx1 = clamp(e.clientX - rect.left, baseBx0 + MIN_W, rect.width);
      commitFromPx(rect, baseBx0, nx1, st);
    } else if (mode === "move") {
      const dx = e.clientX - downX;
      let nx0 = baseBx0 + dx,
        nx1 = baseBx1 + dx;
      if (nx0 < 0) {
        nx1 -= nx0;
        nx0 = 0;
      }
      if (nx1 > rect.width) {
        const over = nx1 - rect.width;
        nx0 -= over;
        nx1 = rect.width;
      }
      commitFromPx(rect, nx0, nx1, st);
    } else if (mode === "create") {
      createEnd = e.clientX;
      commitFromPx(
        rect,
        Math.min(createStart, createEnd) - rect.left,
        Math.max(createStart, createEnd) - rect.left,
        st
      );
    }

    e.preventDefault();
  };

  const end = (e) => {
    brushing = false;
    mode = null;
    minimap.releasePointerCapture?.(e.pointerId);
    minimap.style.cursor = "";
  };

  minimap.addEventListener("pointerdown", onDown, { passive: false });
  minimap.addEventListener("pointermove", onMove, { passive: false });
  minimap.addEventListener("pointerup", end);
  minimap.addEventListener("pointercancel", end);
  minimap.addEventListener("pointerleave", (e) => {
    if (!brushing) minimap.style.cursor = "";
    else end(e);
  });

  return () => {
    minimap.removeEventListener("pointerdown", onDown);
    minimap.removeEventListener("pointermove", onMove);
    minimap.removeEventListener("pointerup", end);
    minimap.removeEventListener("pointercancel", end);
    minimap.removeEventListener("pointerleave", end);
  };
}
