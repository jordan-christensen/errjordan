// axis.js — two-band time axis helpers
import {
  scaleT,
  monthStart,
  nextMonthStart,
  dayStart,
  nextDayStart,
  floorToStep,
  addStep,
} from "./geometry";
import { readLayoutVars } from "./layout";

export function axisHeightTwoBand() {
  const AXIS = { topH: 14, bottomH: 14, gap: 2 };
  return AXIS.topH + AXIS.gap + AXIS.bottomH + AXIS.gap;
}

const TICK_TARGET_PX = 96;
const TICK_TARGETS = { month: 120, week: 110, day: 70, hour: 64 };

function chooseTickSpec(viewStart, viewEnd, px) {
  const span = Math.max(1, viewEnd - viewStart);
  const pxPerMs = px / span;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const week = 7 * day;
  const monthApprox = 30 * day;

  const labeled = [
    { unit: "month", step: 1, ms: monthApprox },
    { unit: "week", step: 1, ms: week },
    { unit: "day", step: 1, ms: day },
    { unit: "hour", step: 1, ms: hour },
  ];
  for (let i = labeled.length - 1; i >= 0; i--) {
    const c = labeled[i];
    const stepPx = c.ms * pxPerMs;
    const target = TICK_TARGETS[c.unit] ?? TICK_TARGET_PX;
    if (stepPx >= target) return c;
  }
  return labeled[0];
}

export function resolveAxisModes(viewStart, viewEnd, px) {
  const spec = chooseTickSpec(viewStart, viewEnd, px);
  const span = Math.max(1, viewEnd - viewStart);
  const pxPerMs = px / span;
  const weekPx = 7 * 24 * 60 * 60 * 1000 * pxPerMs;

  let topMode, bottomUnit;
  if (spec.unit === "hour") {
    topMode = "day";
    bottomUnit = "hour";
  } else if (spec.unit === "day") {
    topMode = "month";
    bottomUnit = "day";
  } else {
    if (weekPx >= 24) {
      topMode = "month";
      bottomUnit = "week-condensed";
    } else {
      topMode = "year";
      bottomUnit = "month";
    }
  }
  return { topMode, bottomUnit };
}

const fmtMonthShort = new Intl.DateTimeFormat(undefined, { month: "short" });
const fmtMonthYear = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});
const fmtYearOnly = new Intl.DateTimeFormat(undefined, { year: "numeric" });
const fmtDayTop = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "2-digit",
});
const fmtWeekDay = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "2-digit",
});

export function drawTopBand(
  ctx,
  innerLeft,
  innerRight,
  viewStart,
  viewEnd,
  mode
) {
  const LYT = readLayoutVars();
  const stickyLeft = innerLeft + 6;
  const y = 11;
  ctx.font = `600 ${LYT.fontAxis} Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillStyle = "#4b5563";

  let curStart, nextStart, format, stepFn;
  if (mode === "year") {
    const d0 = new Date(viewStart);
    d0.setMonth(0, 1);
    d0.setHours(0, 0, 0, 0);
    const d1 = new Date(d0);
    d1.setFullYear(d1.getFullYear() + 1);
    curStart = +d0;
    nextStart = +d1;
    format = (ms) => fmtYearOnly.format(ms);
    stepFn = (ms) => {
      const d = new Date(ms);
      d.setFullYear(d.getFullYear() + 1);
      return d;
    };
  } else if (mode === "month") {
    const d0 = monthStart(viewStart);
    const d1 = nextMonthStart(+d0);
    curStart = +d0;
    nextStart = +d1;
    format = (ms) => fmtMonthYear.format(ms);
    stepFn = (ms) => nextMonthStart(ms);
  } else {
    const d0 = dayStart(viewStart);
    const d1 = nextDayStart(+d0);
    curStart = +d0;
    nextStart = +d1;
    format = (ms) => fmtDayTop.format(ms);
    stepFn = (ms) => nextDayStart(ms);
  }

  const x0 = scaleT(curStart, viewStart, viewEnd, innerLeft, innerRight);
  const x1 = scaleT(nextStart, viewStart, viewEnd, innerLeft, innerRight);
  const lab0 = format(curStart);
  const w0 = ctx.measureText(lab0).width;
  const x0draw = Math.min(Math.max(stickyLeft, x0), x1 - 6 - w0);
  if (x0draw + 2 < innerRight) ctx.fillText(lab0, x0draw, y);

  let prevRight = x0draw + w0;
  for (let m = nextStart; m <= viewEnd; ) {
    const xm = scaleT(m, viewStart, viewEnd, innerLeft, innerRight);
    if (xm > innerRight) break;
    const lab = format(m);
    const w = ctx.measureText(lab).width;
    if (xm >= prevRight + 8 && xm + w / 2 < innerRight) {
      ctx.fillText(lab, xm, y);
      prevRight = xm + w;
    }
    m = +stepFn(m);
  }
}

export function drawBottomBand(
  ctx,
  innerLeft,
  innerRight,
  viewStart,
  viewEnd,
  unit
) {
  const LYT = readLayoutVars();
  const AXIS = { topH: 14, bottomH: 14, gap: 2 };
  const y = AXIS.topH + AXIS.gap + 12;
  ctx.font = `500 ${LYT.fontAxis} Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillStyle = "#6b7280";

  if (unit === "hour") {
    const labelOf = (ms) =>
      String(new Date(ms).getHours()).padStart(2, "0") + ":00";
    {
      const curStart = +floorToStep(viewStart, "hour", 1);
      const nextStart = +addStep(curStart, "hour", 1);
      const lab0 = labelOf(curStart);
      const w0 = ctx.measureText(lab0).width;
      const x0 = scaleT(curStart, viewStart, viewEnd, innerLeft, innerRight);
      const x1 = scaleT(nextStart, viewStart, viewEnd, innerLeft, innerRight);
      const xClamp = Math.min(Math.max(innerLeft + 6, x0), x1 - 6 - w0);
      if (xClamp + 2 < innerRight) ctx.fillText(lab0, xClamp, y);
      var prevRight = xClamp + w0;
    }
    for (
      let t = +addStep(floorToStep(viewStart, "hour", 1), "hour", 1);
      t <= viewEnd;
      t = +addStep(t, "hour", 1)
    ) {
      const lab = labelOf(t);
      const w = ctx.measureText(lab).width;
      const x = scaleT(t, viewStart, viewEnd, innerLeft, innerRight);
      const left = x - w / 2,
        right = x + w / 2;
      if (
        right > innerLeft + 2 &&
        left < innerRight - 2 &&
        left > prevRight + 6
      ) {
        ctx.fillText(lab, left, y);
        prevRight = right;
      }
    }
    return;
  }

  if (unit === "week-condensed") {
    const labelOf = (ms) => String(new Date(ms).getDate()).padStart(2, "0");
    {
      const curStart = +floorToStep(viewStart, "week", 1);
      const nextStart = +addStep(curStart, "week", 1);
      const lab0 = labelOf(curStart);
      const w0 = ctx.measureText(lab0).width;
      const x0 = scaleT(curStart, viewStart, viewEnd, innerLeft, innerRight);
      const x1 = scaleT(nextStart, viewStart, viewEnd, innerLeft, innerRight);
      const xClamp = Math.min(Math.max(innerLeft + 6, x0), x1 - 6 - w0);
      if (xClamp + 2 < innerRight) ctx.fillText(lab0, xClamp, y);
      var prevRight = xClamp + w0;
    }
    for (
      let t = +floorToStep(viewStart, "week", 1);
      t <= viewEnd;
      t = +addStep(t, "week", 1)
    ) {
      if (t === +floorToStep(viewStart, "week", 1)) continue;
      const lab = labelOf(t);
      const w = ctx.measureText(lab).width;
      const x = scaleT(t, viewStart, viewEnd, innerLeft, innerRight);
      const left = x - w / 2,
        right = x + w / 2;
      if (
        right > innerLeft + 2 &&
        left < innerRight - 2 &&
        left > prevRight + 6
      ) {
        ctx.fillText(lab, left, y);
        prevRight = right;
      }
    }
    return;
  }

  let t, stepNext, labelOf;
  if (unit === "month") {
    t = monthStart(viewStart);
    stepNext = (ms) => nextMonthStart(ms);
    labelOf = (ms) => fmtMonthShort.format(ms);
  } else {
    t = dayStart(viewStart);
    stepNext = (ms) => nextDayStart(ms);
    labelOf = (ms) => fmtWeekDay.format(ms);
  }

  {
    const curStart =
      unit === "month" ? +monthStart(viewStart) : +dayStart(viewStart);
    const nextStart =
      unit === "month" ? +nextMonthStart(curStart) : +nextDayStart(curStart);
    const lab0 = labelOf(curStart);
    const w0 = ctx.measureText(lab0).width;
    const x0 = scaleT(curStart, viewStart, viewEnd, innerLeft, innerRight);
    const x1 = scaleT(nextStart, viewStart, viewEnd, innerLeft, innerRight);
    const xClamp = Math.min(Math.max(innerLeft + 6, x0), x1 - 6 - w0);
    if (xClamp + 2 < innerRight) ctx.fillText(lab0, xClamp, y);
    var prevRight = xClamp + w0;
  }

  for (; +t <= viewEnd; t = stepNext(+t)) {
    if (
      +t === (unit === "month" ? +monthStart(viewStart) : +dayStart(viewStart))
    )
      continue;
    const lab = labelOf(+t);
    const w = ctx.measureText(lab).width;
    const x = scaleT(+t, viewStart, viewEnd, innerLeft, innerRight);
    const left = x - w / 2,
      right = x + w / 2;
    if (
      right > innerLeft + 2 &&
      left < innerRight - 2 &&
      left > prevRight + 6
    ) {
      ctx.fillText(lab, left, y);
      prevRight = right;
    }
  }
}

export function collectGridTicks(viewStart, viewEnd, unit) {
  const ticks = [];

  if (unit === "hour") {
    for (
      let t = +floorToStep(viewStart, "hour", 1);
      t <= viewEnd;
      t = +addStep(t, "hour", 1)
    ) {
      ticks.push(t);
    }
    return ticks;
  }

  if (unit === "week-condensed") {
    for (
      let t = +floorToStep(viewStart, "week", 1);
      t <= viewEnd;
      t = +addStep(t, "week", 1)
    ) {
      ticks.push(t);
    }
    return ticks;
  }

  if (unit === "day") {
    for (let t = +dayStart(viewStart); t <= viewEnd; t = +nextDayStart(t)) {
      ticks.push(t);
    }
    return ticks;
  }

  for (let t = +monthStart(viewStart); t <= viewEnd; t = +nextMonthStart(t)) {
    ticks.push(t);
  }

  return ticks;
}
