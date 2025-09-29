// renderer/minimap_renderer.js
import { readTokens } from "../tokens";
import { scaleT } from "../geometry";

function setCanvasSize(c) {
  const dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  c.width = Math.max(1, Math.round(rect.width * dpr));
  c.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawMinimap(canvas, state) {
  const TOK = state.tokens ?? readTokens();
  const ctx = setCanvasSize(canvas);
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const y = 10,
    h = rect.height - 20;
  ctx.globalAlpha = 0.6;
  for (const row of state.rows) {
    for (const s of row.spans || []) {
      const x0 = scaleT(
        s.start,
        state.dataExtent.start,
        state.dataExtent.end,
        0,
        rect.width
      );
      const x1 = scaleT(
        s.end,
        state.dataExtent.start,
        state.dataExtent.end,
        0,
        rect.width
      );
      ctx.fillStyle = s.kind === "missing" ? TOK.muted : "#a1a1aa";
      ctx.fillRect(x0, y, Math.max(1, x1 - x0), h);
    }
  }
  ctx.globalAlpha = 1;

  const bx0 = scaleT(
    state.view.start,
    state.dataExtent.start,
    state.dataExtent.end,
    0,
    rect.width
  );
  const bx1 = scaleT(
    state.view.end,
    state.dataExtent.start,
    state.dataExtent.end,
    0,
    rect.width
  );

  ctx.fillStyle = TOK.brush;
  ctx.fillRect(bx0, 0, Math.max(2, bx1 - bx0), rect.height);
  ctx.strokeStyle = TOK.brushStroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx0 + 1, 1, Math.max(2, bx1 - bx0) - 2, rect.height - 2);
}
