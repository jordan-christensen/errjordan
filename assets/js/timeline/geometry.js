// geometry.js
// Pure time/geometry helpers used by renderers and interactions.

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

/** Clamp a value between a and b */
export function clamp(v, a, b) {
  return Math.min(Math.max(v, a), b);
}

/** Map a time value t in [t0,t1] to an x coordinate in [x0,x1]. */
export function scaleT(t, t0, t1, x0, x1) {
  const spanT = Math.max(1, t1 - t0);
  const spanX = x1 - x0;
  return x0 + ((t - t0) / spanT) * spanX;
}

/** Inverse of scaleT: map an x in [x0,x1] back to time in [t0,t1]. */
export function invScaleX(x, t0, t1, x0, x1) {
  const spanX = Math.max(1e-6, x1 - x0);
  const spanT = t1 - t0;
  return t0 + ((x - x0) / spanX) * spanT;
}

// --- Calendar alignment helpers (UTC-naive, local-time based) ---
// These are sufficient for axis labeling and window calculations.

export function yearStart(ms) {
  const d = new Date(ms);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function nextYearStart(ms) {
  const d = yearStart(ms);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

export function monthStart(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

export function nextMonthStart(ms) {
  const d = monthStart(ms);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export function dayStart(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function nextDayStart(ms) {
  const d = dayStart(ms);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Floor a date to the beginning of a unit boundary. Supports month, week, day, hour, minute. */
export function floorToStep(date, unit, step) {
  const d = new Date(date);
  if (unit === "month") {
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    const m = d.getMonth();
    const floored = Math.floor(m / step) * step;
    d.setMonth(floored);
  } else if (unit === "week") {
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // week starts Sunday
  } else if (unit === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (unit === "hour") {
    const h = d.getHours();
    d.setMinutes(0, 0, 0);
    d.setHours(Math.floor(h / step) * step);
  } else if (unit === "minute") {
    const m = d.getMinutes();
    d.setSeconds(0, 0);
    d.setMinutes(Math.floor(m / step) * step);
  }
  return d;
}

/** Add (step) units to a date. */
export function addStep(date, unit, step) {
  const d = new Date(date);
  if (unit === "month") d.setMonth(d.getMonth() + step);
  else if (unit === "week") d.setDate(d.getDate() + 7 * step);
  else if (unit === "day") d.setDate(d.getDate() + step);
  else if (unit === "hour") d.setHours(d.getHours() + step);
  else if (unit === "minute") d.setMinutes(d.getMinutes() + step);
  return d;
}

/** Return whether the tick is a major boundary for the given unit. */
export function isMajorTick(date, unit) {
  const d = new Date(date);
  if (unit === "month") return d.getMonth() === 0; // Jan (year boundary)
  if (unit === "week" || unit === "day") return d.getDate() === 1; // month start
  if (unit === "hour") return d.getHours() === 0; // midnight
  if (unit === "minute") return d.getMinutes() === 0; // top of hour
  return false;
}
