// renderer/timeline_renderer.js
import { isValve, isGauge } from "../rowGuards";
import { scaleT } from "../geometry";
import {
  drawTopBand,
  drawBottomBand,
  resolveAxisModes,
  axisHeightTwoBand,
  collectGridTicks,
} from "../axis";

function setCanvasSize(c, cssH) {
  const dpr = window.devicePixelRatio || 1;
  if (typeof cssH === "number") c.style.height = cssH + "px";
  const rect = c.getBoundingClientRect();
  c.width = Math.max(1, Math.round(rect.width * dpr));
  c.height = Math.max(1, Math.round((cssH ?? rect.height) * dpr));
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawTimeline(canvas, state) {
  const LYT = state.layout;
  const TOK = state.tokens;

  const topPad = axisHeightTwoBand();
  const bottomPad = 16;
  const scale = LYT.rowScale || 1;
  const baseRow = Math.max(24, Math.round((LYT.rowBase || 28) * scale));
  const hints = LYT.rowHeights || {};
  const scaledHint = (hint) => Math.max(24, Math.round(hint * scale));
  const heightForRow = (row) => {
    const hint = (row.kind && hints[row.kind]) || hints.default || 0;
    return hint > 0 ? scaledHint(hint) : baseRow;
  };

  const rowHeights = state.rows.map(heightForRow);
  const rowOffsets = [];
  let cursorY = topPad;
  for (const h of rowHeights) {
    rowOffsets.push(cursorY);
    cursorY += h;
  }
  const totalH = Math.max(topPad + bottomPad, cursorY + bottomPad);

  const ctx = setCanvasSize(canvas, totalH);
  const rect = canvas.getBoundingClientRect();
  const innerLeft = LYT.gutter;
  const innerRight = rect.width;
  const contentBottom =
    rowOffsets.length > 0
      ? rowOffsets[rowOffsets.length - 1] + rowHeights[rowHeights.length - 1]
      : topPad;
  ctx.clearRect(0, 0, rect.width, rect.height);

  for (let i = 0; i < state.rows.length; i++) {
    const yTop = rowOffsets[i];
    const rowH = rowHeights[i];
    ctx.fillStyle = i % 2 === 0 ? TOK.bgAlt : "#fff";
    ctx.fillRect(innerLeft, yTop, innerRight - innerLeft, rowH);
  }

  const { bottomUnit, topMode } = resolveAxisModes(
    state.view.start,
    state.view.end,
    innerRight - innerLeft
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(innerLeft, 0, rect.width - innerLeft, rect.height);
  ctx.clip();
  drawTopBand(
    ctx,
    innerLeft,
    rect.width,
    state.view.start,
    state.view.end,
    topMode
  );
  drawBottomBand(
    ctx,
    innerLeft,
    rect.width,
    state.view.start,
    state.view.end,
    bottomUnit
  );
  ctx.restore();

  const gridXs = collectGridTicks(
    state.view.start,
    state.view.end,
    bottomUnit
  )
    .map((ms) => scaleT(ms, state.view.start, state.view.end, innerLeft, innerRight))
    .filter((x) => x > innerLeft + 0.5 && x < innerRight - 0.5);

  if (gridXs.length) {
    ctx.save();
    ctx.strokeStyle = TOK.grid;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of gridXs) {
      const px = Math.round(x) + 0.5;
      ctx.moveTo(px, topPad);
      ctx.lineTo(px, contentBottom);
    }
    ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < state.rows.length; i++) {
    const row = state.rows[i];
    const yTop = rowOffsets[i];
    const rowH = rowHeights[i];

    drawRowLabel(ctx, row, yTop, rowH, innerLeft, LYT, TOK);

    if (isValve(row)) {
      drawValveRow(ctx, row, yTop, rowH, innerLeft, rect.width, state);
    } else if (isGauge(row)) {
      drawGaugeRow(ctx, row, yTop, rowH, innerLeft, rect.width, state);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawValveRow(ctx, row, y, rowH, leftPx, rightPx, state) {
  const TOK = state.tokens;
  const laneH = Math.max(12, rowH - 10);
  const laneTop = y + (rowH - laneH) / 2;

  const fillForKind = (kind) => {
    const spec = {
      nominal:    { solid: TOK.nominal,    start: TOK.nominalGradStart,    end: TOK.nominalGradEnd },
      confirmed:  { solid: TOK.confirmed,  start: TOK.confirmedGradStart,  end: TOK.confirmedGradEnd },
      unexpected: { solid: TOK.unexpected, start: TOK.unexpectedGradStart, end: TOK.unexpectedGradEnd },
      missing:    { solid: TOK.missing,    start: TOK.missingGradStart,    end: TOK.missingGradEnd },
    }[kind] || { solid: TOK.text, start: "", end: "" };
    if (spec.start && spec.end) {
      // vertical gradient (top→bottom)
      const g = ctx.createLinearGradient(0, laneTop, 0, laneTop + laneH);
      g.addColorStop(0, spec.start);
      g.addColorStop(1, spec.end);
      return g;
    }
    return spec.solid;
  };

  for (const s of row.spans) {
    if (s.end < state.view.start || s.start > state.view.end) continue;
    const x0 = scaleT(s.start, state.view.start, state.view.end, leftPx, rightPx);
    const x1 = scaleT(s.end, state.view.start, state.view.end, leftPx, rightPx);
    const w  = Math.max(2, x1 - x0);

    ctx.globalAlpha = s.kind === "missing" ? 0.4 : 1;
    ctx.fillStyle = fillForKind(s.kind);

    roundRect(ctx, x0, laneTop, w, laneH, Math.min(6, laneH / 2));
    ctx.fill();

    if (s.kind === "unexpected") {
      ctx.strokeStyle = "#7f1d1d";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}

function drawGaugeRow(ctx, row, y, rowH, leftPx, rightPx, state) {
  const TOK = state.tokens;
  const vis = row.samples.filter(
    (p) => p.t >= state.view.start && p.t <= state.view.end
  );
  if (vis.length < 2) return;

  const laneTop = y + Math.max(6, rowH * 0.2);
  const laneBottom = y + rowH - Math.max(6, rowH * 0.2);
  const laneH = Math.max(12, laneBottom - laneTop);
  const ys = vis.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = Math.max(1e-6, maxY - minY);
  const yToPx = (v) => laneBottom - ((v - minY) / range) * laneH;

  const firstX = scaleT(
    vis[0].t,
    state.view.start,
    state.view.end,
    leftPx,
    rightPx
  );

  ctx.save();
  const gradient = ctx.createLinearGradient(0, laneTop, 0, laneBottom);
  gradient.addColorStop(0, TOK.gaugeFillStart || "rgba(14,165,233,0.25)");
  gradient.addColorStop(1, TOK.gaugeFillEnd || "rgba(14,165,233,0.04)");
  ctx.beginPath();
  ctx.moveTo(firstX, laneBottom);
  ctx.lineTo(firstX, yToPx(vis[0].y));
  for (let i = 1; i < vis.length; i++) {
    const x = scaleT(
      vis[i].t,
      state.view.start,
      state.view.end,
      leftPx,
      rightPx
    );
    ctx.lineTo(x, yToPx(vis[i].y));
  }
  const lastX = scaleT(
    vis[vis.length - 1].t,
    state.view.start,
    state.view.end,
    leftPx,
    rightPx
  );
  ctx.lineTo(lastX, laneBottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.65;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = TOK.gaugeStroke || TOK.text;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.moveTo(firstX, yToPx(vis[0].y));
  for (let i = 1; i < vis.length; i++) {
    const x = scaleT(
      vis[i].t,
      state.view.start,
      state.view.end,
      leftPx,
      rightPx
    );
    ctx.lineTo(x, yToPx(vis[i].y));
  }
  ctx.stroke();
  ctx.restore();

  if (row.gaps) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = state.tokens.muted;
    for (const g of row.gaps) {
      if (g.end < state.view.start || g.start > state.view.end) continue;
      const x0 = scaleT(g.start, state.view.start, state.view.end, leftPx, rightPx);
      const x1 = scaleT(g.end, state.view.start, state.view.end, leftPx, rightPx);
      ctx.fillRect(x0, laneTop, Math.max(1, x1 - x0), laneH);
    }
    ctx.restore();
  }
}

function drawRowLabel(ctx, row, y, rowH, gutter, layout, tokens) {
  const fontFamily = "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const primaryFont = `500 ${layout.fontRow} ${fontFamily}`;
  const baseSize = parseFloat(layout.fontRow) || 12;
  const secondaryFont = `400 ${Math.max(10, Math.round(baseSize * 0.9))}px ${fontFamily}`;
  const name = row.label?.name || "";
  const serial = row.label?.serial || "";

  ctx.save();
  ctx.textAlign = "left";
  ctx.fillStyle = tokens.text;

  if (layout.labelStack) {
    const x = gutter + 12;
    const topLine = y + Math.min(rowH * 0.4, baseSize + 4);
    ctx.textBaseline = "alphabetic";
    ctx.font = primaryFont;
    ctx.fillText(name || serial, x, topLine);

    if (name && serial) {
      ctx.font = secondaryFont;
      ctx.fillStyle = tokens.muted;
      const secondaryY = Math.min(y + rowH - 6, topLine + baseSize + 6);
      ctx.fillText(serial, x, secondaryY);
    }
  } else {
    const x = 12;
    ctx.textBaseline = "middle";
    ctx.font = primaryFont;
    ctx.fillText(name || serial, x, y + rowH / 2);

    if (name && serial) {
      ctx.font = secondaryFont;
      ctx.fillStyle = tokens.muted;
      ctx.fillText(serial, x, Math.min(y + rowH - 8, y + rowH / 2 + baseSize));
    }
  }

  ctx.restore();
}
