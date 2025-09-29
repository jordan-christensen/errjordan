// Concept A — multi-row (10 valves) timeline with minimap/heatmap + brush selection

(function () {
  // ---- Tokens ----
  function readTokens() {
    const s = getComputedStyle(document.documentElement);
    return {
      grid: s.getPropertyValue("--grid-line").trim() || "#e5e7eb",
      muted: s.getPropertyValue("--tone-muted").trim() || "#a1a1aa",
      verified: s.getPropertyValue("--color-verified").trim() || "#16a34a",
      unexpected: s.getPropertyValue("--color-unexpected").trim() || "#dc2626",
      manual: s.getPropertyValue("--color-manual").trim() || "#2563eb",
      bgAlt: s.getPropertyValue("--row-alt").trim() || "#fafafa",
      text: s.getPropertyValue("--text").trim() || "#0f172a",
      brush: "rgba(59,130,246,0.15)",
      brushStroke: "#2563eb",
    };
  }
  let TOK = readTokens();

  // ---- Layout Vars (from CSS) ----
  function readLayoutVars() {
    const s = getComputedStyle(document.documentElement);
    const num = (v) => parseFloat(v) || 0;
    const str = (v, fallback) => (v && v.trim()) || fallback;
    return {
      gutter: num(s.getPropertyValue('--gutter')) || 140,
      rowBase: num(s.getPropertyValue('--row-h-base')) || 28,
      rowScale: num(s.getPropertyValue('--row-scale')) || 1,
      fontAxis: str(s.getPropertyValue('--font-axis'), '12px'),
      fontRow:  str(s.getPropertyValue('--font-row'),  '12px'),
      labelStack: (parseInt(s.getPropertyValue('--row-label-stack')) || 0) === 1,
    };
  }

  // ---- Geometry ----
  const DAY = 24 * 60 * 60 * 1000;
  const GUTTER = 140; // default; overridden by CSS var via readLayoutVars()
  const TOP_PAD = 28; // space for day ticks/labels (axis heights handled separately)

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const scaleT = (t, t0, t1, x0, x1) => x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
  const invScaleX = (x, t0, t1, x0, x1) =>
    t0 + ((x - x0) / (x1 - x0)) * (t1 - t0);

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

  // ---- Mock data (10 rows) ----
  const now = Date.now();
  const dataStart = now - 60 * DAY;
  const dataEnd = now;
  const KINDS = ["verified", "unexpected", "manual"];
  const ROW_COUNT = 10;

  function genEvents() {
    const evts = [],
      R = (a, b) => a + Math.random() * (b - a);
    const spanDays = Math.round((dataEnd - dataStart) / DAY);
    for (let d = 0; d < spanDays; d++) {
      const base = dataStart + d * DAY;
      const count = Math.random() < 0.7 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const s = base + R(2 * 60 * 60 * 1000, 22 * 60 * 60 * 1000);
        const dur = R(10, 90) * 60 * 1000;
        const kind = KINDS[Math.floor(R(0, KINDS.length))];
        evts.push({ start: s, end: s + dur, kind });
      }
      // occasional long gap
      if (Math.random() < 0.08) {
        const gapStart = base + R(0, 20) * 60 * 60 * 1000;
        evts.push({
          start: gapStart,
          end: gapStart + 3 * 60 * 60 * 1000,
          kind: "gap",
        });
      }
    }
    return evts.sort((a, b) => a.start - b.start);
  }

  const ROWS = Array.from({ length: ROW_COUNT }, (_, i) => ({
    id: `v-${(i + 1).toString().padStart(2, "0")}`,
    name: `Valve ${(i + 1).toString().padStart(2, "0")}`,
    events: genEvents(),
  }));

  // ---- DOM & State ----
  const timeline = document.getElementById("timeline");
  const minimap = document.getElementById("minimap");
  const rangeLabel = document.getElementById("rangeLabel");
  const toolBtns = Array.from(document.querySelectorAll(".controls .tool"));

  // Period controls DOM
  const durationChips = Array.from(
    document.querySelectorAll("[data-duration]")
  );
  const anchorChips = Array.from(document.querySelectorAll("[data-anchor]"));
  const periodDate = document.getElementById("periodDate");
  const periodTime = document.getElementById("periodTime");
  const applyBtn = document.getElementById("applyPeriod");
  const periodPreview = document.getElementById("periodPreview");

  // Duration map
  const DUR = {
    "12h": 12 * 60 * 60 * 1000,
    "1d": 1 * DAY,
    "3d": 3 * DAY,
    "1w": 7 * DAY,
    "2w": 14 * DAY,
    "1m": 30 * DAY,
    "4m": 120 * DAY,
    "6m": 180 * DAY,
    "1y": 365 * DAY,
  };

  // Loaded extent (what data is queryable) — start with 2w ending now
  let loadedStart = now - DUR["2w"];
  let loadedEnd = now;

  // View window (what you’re currently looking at) — initially full loaded extent
  let viewStart = loadedStart;
  let viewEnd = loadedEnd;

  // Period selector state
  let period = { durationKey: "2w", anchor: "end", at: new Date(loadedEnd) };

  // let viewEnd = dataEnd;

  // ---- Renderers ----
  function formatRange(a, b) {
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
    });
    const fmtTime = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return b - a <= DAY
      ? `${fmtTime.format(a)} – ${fmtTime.format(b)}`
      : `${fmt.format(a)} – ${fmt.format(b)}`;
  }

  function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function combineDateTime(dateStr, timeStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    let h = 0,
      min = 0;
    if (timeStr) {
      const [hh, mm] = timeStr.split(":").map(Number);
      h = hh || 0;
      min = mm || 0;
    }
    return new Date(y, m - 1, d, h, min, 0, 0);
  }
  function updatePeriodPreview() {
    const dur = DUR[period.durationKey];
    const subDay = dur < DAY;
    const baseDate = period.at;
    let start, end;
    if (period.anchor === "start") {
      if (subDay) {
        start = baseDate;
        end = new Date(start.getTime() + dur);
      } else {
        const s = dayStart(baseDate);
        start = s;
        end = new Date(s.getTime() + dur);
      }
    } else {
      if (subDay) {
        end = baseDate;
        start = new Date(end.getTime() - dur);
      } else {
        const e = dayStart(baseDate).getTime() + DAY;
        end = new Date(e);
        start = new Date(e - dur);
      }
    }
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    periodPreview.textContent = `Will load ${fmt.format(start)} → ${fmt.format(
      end
    )} (${
      Math.round(dur / (24 * 60 * 60 * 1000)) >= 1
        ? Math.round(dur / DAY) + " days"
        : Math.round(dur / 3600000) + " hours"
    })`;
  }

  periodDate.value = ymd(period.at);
  periodTime.value = "00:00";
  periodTime.style.display = DUR[period.durationKey] < DAY ? "" : "none";
  updatePeriodPreview();

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

  // ---- Two-band Axis (top sticky + bottom scrolling) ----
  const AXIS = { topH: 14, bottomH: 14, gap: 2 };
  function axisHeightTwoBand() {
    return AXIS.topH + AXIS.gap + AXIS.bottomH + AXIS.gap;
  }

  function yearStart(ms) {
    const d = new Date(ms);
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function nextYearStart(ms) {
    const d = yearStart(ms);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  function monthStart(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    return d;
  }
  function nextMonthStart(ms) {
    const d = monthStart(ms);
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  function dayStart(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function nextDayStart(ms) {
    const d = dayStart(ms);
    d.setDate(d.getDate() + 1);
    return d;
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

  // ---- Adaptive tick engine ----
  const TICK_TARGET_PX = 96; // desired spacing between labels
  // Per-unit label spacing so we scale to days/hours a bit sooner
  const TICK_TARGETS = { month: 120, week: 110, day: 70, hour: 64 };

  function chooseTickSpec(viewStart, viewEnd, px) {
    const span = Math.max(1, viewEnd - viewStart);
    const pxPerMs = px / span;
    const minute = 60_000,
      hour = 60 * minute,
      day = 24 * hour,
      week = 7 * day,
      monthApprox = 30 * day;

    // Labeled steps only (coarse → fine). We scan in reverse to pick the finest that still meets per-unit spacing.
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

  function floorToStep(date, unit, step) {
    const d = new Date(date);
    if (unit === "month") {
      d.setHours(0, 0, 0, 0);
      d.setDate(1);
      const m = d.getMonth();
      const floored = Math.floor(m / step) * step;
      d.setMonth(floored);
    } else if (unit === "week") {
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay()); // Week starts on Sunday
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

  function addStep(date, unit, step) {
    const d = new Date(date);
    if (unit === "month") d.setMonth(d.getMonth() + step);
    else if (unit === "week") d.setDate(d.getDate() + 7 * step);
    else if (unit === "day") d.setDate(d.getDate() + step);
    else if (unit === "hour") d.setHours(d.getHours() + step);
    else if (unit === "minute") d.setMinutes(d.getMinutes() + step);
    return d;
  }

  function isMajorTick(date, unit) {
    const d = new Date(date);
    if (unit === "month") return d.getMonth() === 0; // Jan (year boundary)
    if (unit === "week" || unit === "day") return d.getDate() === 1; // month start
    if (unit === "hour") return d.getHours() === 0; // midnight
    if (unit === "minute") return d.getMinutes() === 0; // top of hour
    return false;
  }

  const fmtMonth = new Intl.DateTimeFormat(undefined, { month: "short" });
  const fmtYear = new Intl.DateTimeFormat(undefined, { year: "numeric" });
  const fmtDay = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
  });
  const fmtWeekDay = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
  });
  const fmtHour = new Intl.DateTimeFormat(undefined, { hour: "2-digit" });
  const fmtHourMin = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  function formatTick(t, unit, major) {
    const d = new Date(t);
    if (unit === "month") return major ? fmtYear.format(d) : fmtMonth.format(d);
    if (unit === "week") return major ? fmtMonth.format(d) : fmtDay.format(d); // major at month start, minor shows date
    if (unit === "day")
      return major ? fmtMonth.format(d) : fmtWeekDay.format(d); // minor shows weekday+date
    if (unit === "hour") return major ? fmtDay.format(d) : fmtHour.format(d); // major at midnight shows date
    return fmtDay.format(d);
  }

  function generateTicks(viewStart, viewEnd, px) {
    const spec = chooseTickSpec(viewStart, viewEnd, px);
    const ticks = [];
    let t = floorToStep(viewStart, spec.unit, spec.step);
    const hardStop = viewEnd + (viewEnd - viewStart);
    while (+t <= hardStop) {
      const major = isMajorTick(t, spec.unit);
      ticks.push({ t: +t, unit: spec.unit, step: spec.step, major });
      t = addStep(t, spec.unit, spec.step);
      if (+t > viewEnd && ticks.length > 2000) break;
    }
    return { spec, ticks };
  }

  // Return unlabeled, faint subticks for visual guidance depending on main labeled unit
  function generateSubticks(viewStart, viewEnd, px, spec) {
    const minute = 60_000,
      hour = 60 * minute,
      day = 24 * hour,
      week = 7 * day;
    let subUnit = null,
      subStep = 0;
    if (spec.unit === "week") {
      subUnit = "day";
      subStep = 1;
    } else if (spec.unit === "day") {
      subUnit = "hour";
      subStep = 6;
    } else if (spec.unit === "hour") {
      subUnit = "minute";
      subStep = 15;
    } else if (spec.unit === "month") {
      subUnit = "week";
      subStep = 1;
    } else return [];

    const subticks = [];
    let t = floorToStep(viewStart, subUnit, subStep);
    const hardStop = viewEnd + (viewEnd - viewStart);
    while (+t <= hardStop) {
      subticks.push({ t: +t, unit: subUnit, step: subStep });
      t = addStep(t, subUnit, subStep);
      if (+t > viewEnd && subticks.length > 4000) break;
    }
    return subticks;
  }

  // Top band (sticky): mode = 'year' | 'month' | 'day'
  function drawTopBand(ctx, innerLeft, innerRight, viewStart, viewEnd, mode) {
    const stickyLeft = innerLeft + 6;
    const LYT = readLayoutVars();
    const y = 11; // baseline in top band
    ctx.font = `600 ${LYT.fontAxis} Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.fillStyle = "#4b5563";

    let curStart, nextStart, format, stepFn;
    if (mode === "year") {
      curStart = +yearStart(viewStart);
      nextStart = +nextYearStart(curStart);
      format = (ms) => fmtYearOnly.format(ms);
      stepFn = nextYearStart;
    } else if (mode === "month") {
      curStart = +monthStart(viewStart);
      nextStart = +nextMonthStart(curStart);
      format = (ms) => fmtMonthYear.format(ms);
      stepFn = nextMonthStart;
    } /* day */ else {
      curStart = +dayStart(viewStart);
      nextStart = +nextDayStart(curStart);
      format = (ms) => fmtDayTop.format(ms);
      stepFn = nextDayStart;
    }

    const x0 = scaleT(curStart, viewStart, viewEnd, innerLeft, innerRight);
    const x1 = scaleT(nextStart, viewStart, viewEnd, innerLeft, innerRight);
    const lab0 = format(curStart);
    const w0 = ctx.measureText(lab0).width;
    const x0draw = Math.min(Math.max(stickyLeft, x0), x1 - 6 - w0);
    if (x0draw + 2 < innerRight) ctx.fillText(lab0, x0draw, y);

    let prevRight = x0draw + w0;
    for (let m = nextStart; m <= viewEnd; m = +stepFn(m)) {
      const xm = scaleT(m, viewStart, viewEnd, innerLeft, innerRight);
      if (xm > innerRight) break;
      const lab = format(m);
      const w = ctx.measureText(lab).width;
      if (xm >= prevRight + 8 && xm + w / 2 < innerRight) {
        ctx.fillText(lab, xm, y);
        prevRight = xm + w;
      }
    }
  }

  function drawBottomBand(
    ctx,
    innerLeft,
    innerRight,
    viewStart,
    viewEnd,
    unit
  ) {
    const y = AXIS.topH + AXIS.gap + 12; // baseline for bottom band
    const LYT = readLayoutVars();
    ctx.font = `500 ${LYT.fontAxis} Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.fillStyle = "#6b7280";

    // --- Hour scale: early return after drawing per density tier ---
    if (unit === "hour") {
      const span = Math.max(1, viewEnd - viewStart);
      const pxPerMs = (innerRight - innerLeft) / span;
      const hourPx = 60 * 60 * 1000 * pxPerMs;

      const chooseHours = (startMs) => {
        const out = [];
        let tH = floorToStep(startMs, "hour", 1);
        if (hourPx >= 64) {
          // every hour
          while (+tH <= viewEnd) {
            out.push(+tH);
            tH = addStep(tH, "hour", 1);
            if (out.length > 4000) break;
          }
        } else if (hourPx >= 36) {
          // 00, 06, 12, 18
          while (+tH <= viewEnd) {
            const h = new Date(+tH).getHours();
            if (h === 0 || h === 6 || h === 12 || h === 18) out.push(+tH);
            tH = addStep(tH, "hour", 1);
            if (out.length > 4000) break;
          }
        } else {
          // 00 and 12 only
          while (+tH <= viewEnd) {
            const h = new Date(+tH).getHours();
            if (h === 0 || h === 12) out.push(+tH);
            tH = addStep(tH, "hour", 1);
            if (out.length > 4000) break;
          }
        }
        return out;
      };

      const hours = chooseHours(viewStart);
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
        var prevRight = xClamp + w0; // seed spacing baseline
      }

      for (const ht of hours) {
        if (ht === +floorToStep(viewStart, "hour", 1)) continue;
        const lab = labelOf(ht);
        const w = ctx.measureText(lab).width;
        const x = scaleT(ht, viewStart, viewEnd, innerLeft, innerRight);
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
      return; // hour branch returns early
    }

    // --- Week-condensed: Sunday markers as short numeric dates; early return ---
    if (unit === "week-condensed") {
      let t = floorToStep(viewStart, "week", 1); // week starts Sunday
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
        var prevRight = xClamp + w0; // seed baseline
      }

      while (+t <= viewEnd) {
        if (+t === +floorToStep(viewStart, "week", 1)) {
          t = addStep(t, "week", 1);
          continue;
        }
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
        t = addStep(t, "week", 1);
      }
      return;
    }

    // --- Month/Day scales share the same drawing loop below ---
    let t, stepNext, labelOf;
    if (unit === "month") {
      t = monthStart(viewStart);
      stepNext = nextMonthStart;
      labelOf = (ms) => fmtMonthShort.format(ms);
    } else {
      // 'day'
      t = dayStart(viewStart);
      stepNext = nextDayStart;
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
      var prevRight = xClamp + w0; // seed baseline
    }

    while (+t <= viewEnd) {
      if (
        +t ===
        (unit === "month" ? +monthStart(viewStart) : +dayStart(viewStart))
      ) {
        t = stepNext(+t);
        continue;
      }
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
      t = stepNext(+t);
    }
  }

  function renderTimeline() {
    const preRect = timeline.getBoundingClientRect();
    const LYT = readLayoutVars();
    const ROW_H = Math.max(24, Math.round(LYT.rowBase * LYT.rowScale));
    const GUT = LYT.gutter || GUTTER;
    const innerLeft = GUT;
    const innerRight = preRect.width;
    const { spec, topMode, bottomUnit } = resolveAxisModes(
      viewStart,
      viewEnd,
      innerRight - innerLeft
    );
    const topPad = axisHeightTwoBand();

    const totalH = topPad + ROW_COUNT * ROW_H + 8;
    const ctx = setCanvasSize(timeline, totalH);
    const rect = timeline.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    const L = innerLeft,
      R = rect.width;

    // Bottom ticks for grid
    let bottomTicks = [];
    if (bottomUnit === "month") {
      for (
        let t = +monthStart(viewStart);
        t <= viewEnd + (viewEnd - viewStart);
        t = +nextMonthStart(t)
      ) {
        bottomTicks.push(t);
        if (bottomTicks.length > 2000) break;
      }
    } else if (bottomUnit === "week-condensed") {
      for (
        let t = +floorToStep(viewStart, "week", 1);
        t <= viewEnd + (viewEnd - viewStart);
        t = +addStep(new Date(t), "week", 1)
      ) {
        bottomTicks.push(t);
        if (bottomTicks.length > 3000) break;
      }
    } else if (bottomUnit === "day") {
      for (
        let t = +dayStart(viewStart);
        t <= viewEnd + (viewEnd - viewStart);
        t = +nextDayStart(t)
      ) {
        bottomTicks.push(t);
        if (bottomTicks.length > 2000) break;
      }
    } else {
      for (
        let t = +floorToStep(viewStart, "hour", 1);
        t <= viewEnd + (viewEnd - viewStart);
        t = +addStep(new Date(t), "hour", 1)
      ) {
        bottomTicks.push(t);
        if (bottomTicks.length > 4000) break;
      }
    }

    for (const t of bottomTicks) {
      const x = scaleT(t, viewStart, viewEnd, L, R);
      if (x < L - 1 || x > R + 1) continue;
      const d = new Date(t);
      const major =
        bottomUnit === "month"
          ? d.getMonth() === 0
          : bottomUnit === "week-condensed"
          ? d.getDate() === 1
          : bottomUnit === "day"
          ? d.getDate() === 1
          : d.getHours() === 0;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.lineWidth = major ? 1.5 : 1;
      ctx.strokeStyle = TOK.grid;
      ctx.globalAlpha = major ? 1.0 : 0.7;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Two bands
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, 0, R - L, rect.height);
    ctx.clip();
    drawTopBand(ctx, L, R, viewStart, viewEnd, topMode);
    drawBottomBand(ctx, L, R, viewStart, viewEnd, bottomUnit);
    ctx.restore();

    // rows/events (unchanged)
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `500 ${LYT.fontRow} Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    for (let i = 0; i < ROWS.length; i++) {
      const row = ROWS[i];
      const y = topPad + i * ROW_H;
      ctx.fillStyle = i % 2 === 0 ? TOK.bgAlt : "#fff";
      ctx.fillRect(GUT, y - 2, rect.width - GUT, ROW_H + 4);
      ctx.fillStyle = TOK.text;
      if (LYT.labelStack) {
        // stacked: draw name inside lane, left padded
        const padX = 8;
        const labelY = y + Math.min(16, ROW_H * 0.35);
        ctx.textAlign = 'left';
        ctx.fillText(row.name, GUT + padX, labelY);
      } else {
        // inline left in gutter
        ctx.textAlign = 'left';
        ctx.fillText(row.name, 8, y + ROW_H / 2);
      }

      const vis = row.events.filter(
        (e) => e.end >= viewStart && e.start <= viewEnd
      );
      for (const e of vis) {
        const x0 = scaleT(e.start, viewStart, viewEnd, GUT, rect.width);
        const x1 = scaleT(e.end, viewStart, viewEnd, GUT, rect.width);
        const w = Math.max(2, x1 - x0);
        if (e.kind === "gap") {
          ctx.fillStyle = TOK.muted;
          ctx.globalAlpha = 0.4;
        } else if (e.kind === "verified") {
          ctx.fillStyle = TOK.verified;
          ctx.globalAlpha = 1;
        } else if (e.kind === "unexpected") {
          ctx.fillStyle = TOK.unexpected;
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = TOK.manual;
          ctx.globalAlpha = 1;
        }
        roundRect(ctx, x0, y, w, ROW_H, Math.min(4, ROW_H / 2));
        ctx.fill();
        if (e.kind === "unexpected") {
          ctx.strokeStyle = "#7f1d1d";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    if (rangeLabel)
      rangeLabel.textContent = formatRange(
        new Date(viewStart),
        new Date(viewEnd)
      );
  }

  function renderMinimap() {
    const ctx = setCanvasSize(minimap); // CSS sets height
    const rect = minimap.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // density bars across ALL rows
    const y = 10,
      h = rect.height - 20;
    ctx.globalAlpha = 0.6;
    for (const row of ROWS) {
      for (const e of row.events) {
        const x0 = scaleT(e.start, dataStart, dataEnd, 0, rect.width);
        const x1 = scaleT(e.end, dataStart, dataEnd, 0, rect.width);
        ctx.fillStyle = e.kind === "gap" ? TOK.muted : "#a1a1aa";
        ctx.fillRect(x0, y, Math.max(1, x1 - x0), h);
      }
    }
    ctx.globalAlpha = 1;

    // current view brush
    const bx0 = scaleT(viewStart, loadedStart, loadedEnd, 0, rect.width);
    const bx1 = scaleT(viewEnd, loadedStart, loadedEnd, 0, rect.width);
    // Dim areas outside the loaded extent
    const lx0 = scaleT(loadedStart, dataStart, dataEnd, 0, rect.width);
    const lx1 = scaleT(loadedEnd, dataStart, dataEnd, 0, rect.width);
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    if (lx0 > 0) ctx.fillRect(0, 0, lx0, rect.height);
    if (lx1 < rect.width) ctx.fillRect(lx1, 0, rect.width - lx1, rect.height);

    ctx.fillStyle = TOK.brush;
    ctx.fillRect(bx0, 0, Math.max(2, bx1 - bx0), rect.height);
    ctx.strokeStyle = TOK.brushStroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx0 + 1, 1, Math.max(2, bx1 - bx0) - 2, rect.height - 2);

    // resize handles with chevrons
    const handleW = 10;
    const drawHandle = (x, dir) => {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x - handleW / 2, 4, handleW, rect.height - 8);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = TOK.brushStroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - handleW / 2 + 0.5, 4.5, handleW - 1, rect.height - 9);
      ctx.translate(x, rect.height / 2);
      ctx.beginPath();
      if (dir === "left") {
        ctx.moveTo(-2, 0);
        ctx.lineTo(2, -5);
        ctx.lineTo(2, 5);
      } else {
        ctx.moveTo(2, 0);
        ctx.lineTo(-2, -5);
        ctx.lineTo(-2, 5);
      }
      ctx.closePath();
      ctx.fillStyle = TOK.brushStroke;
      ctx.fill();
      ctx.restore();
    };
    drawHandle(bx0, "left");
    drawHandle(bx1, "right");
  }

  function render() {
    renderTimeline();
    renderMinimap();
  }

  function clampView(ns, ne) {
    const minSpan = 15 * 60 * 1000; // 15 minutes
    const maxSpan = loadedEnd - loadedStart;
    const span = clamp(ne - ns, minSpan, Math.max(minSpan, maxSpan));
    if (ns < loadedStart) {
      ns = loadedStart;
      ne = ns + span;
    }
    if (ne > loadedEnd) {
      ne = loadedEnd;
      ns = ne - span;
    }
    return [ns, ne];
  }

  function zoomFactor(f) {
    const center = (viewStart + viewEnd) / 2;
    const span = (viewEnd - viewStart) * f;
    let ns = center - span / 2,
      ne = center + span / 2;
    [viewStart, viewEnd] = clampView(ns, ne);
    render();
  }
  function shiftFrac(frac) {
    const span = viewEnd - viewStart;
    const dt = span * frac;
    let ns = viewStart + dt,
      ne = viewEnd + dt;
    [viewStart, viewEnd] = clampView(ns, ne);
    render();
  }
  toolBtns.forEach((btn) => {
    if (btn.dataset.zoom) {
      btn.addEventListener("click", () =>
        zoomFactor(btn.dataset.zoom === "in" ? 0.8 : 1.25)
      );
    } else if (btn.dataset.shift) {
      btn.addEventListener("click", () =>
        shiftFrac(parseFloat(btn.dataset.shift))
      );
    }
  });

  function resolveAxisModes(viewStart, viewEnd, px) {
    const spec = chooseTickSpec(viewStart, viewEnd, px);
    const span = Math.max(1, viewEnd - viewStart);
    const pxPerMs = px / span;
    const dayPx = 24 * 60 * 60 * 1000 * pxPerMs;
    const weekPx = 7 * 24 * 60 * 60 * 1000 * pxPerMs;

    let topMode, bottomUnit;
    if (spec.unit === "hour") {
      // Tight
      topMode = "day";
      bottomUnit = "hour";
    } else if (spec.unit === "day") {
      // Mid
      topMode = "month";
      bottomUnit = "day";
    } else {
      // Wide (spec.week or spec.month)
      // If weeks are reasonably wide, offer condensed weekly labels before full days
      if (weekPx >= 24) {
        topMode = "month"; // show Month Year on top sooner
        bottomUnit = "week-condensed"; // bottom shows weekly cadence labels (short)
      } else {
        topMode = "year";
        bottomUnit = "month";
      }
    }
    return { spec, topMode, bottomUnit };
  }

  // ---- Wheel zoom (modifier or strong horizontal only) ----
  timeline.addEventListener(
    "wheel",
    (ev) => {
      const horizontalIntent = Math.abs(ev.deltaX) > Math.abs(ev.deltaY);
      const modifier = ev.shiftKey || ev.altKey || ev.ctrlKey || ev.metaKey;
      if (!(horizontalIntent || modifier)) return; // let vertical scroll pass
      ev.preventDefault();
      const rect = timeline.getBoundingClientRect();
      const GUT = (getComputedStyle(document.documentElement).getPropertyValue('--gutter') || '').trim();
      const gutPx = parseFloat(GUT) || 140;
      const mx = ev.clientX - rect.left;
      const delta = Math.abs(ev.deltaY) > 0 ? ev.deltaY : ev.deltaX;
      const zoom = Math.exp(-delta * 0.0015);
      const centerT = invScaleX(mx, viewStart, viewEnd, gutPx, rect.width);
      const span = clamp(
        (viewEnd - viewStart) * zoom,
        15 * 60 * 1000,
        dataEnd - dataStart
      );
      let ns = centerT - (mx / rect.width) * span;
      let ne = ns + span;
      [viewStart, viewEnd] = clampView(ns, ne);
      render();
    },
    { passive: false }
  );

  // ---- Drag to pan (mouse) ----
  let panning = false,
    panX = 0,
    panRange = [viewStart, viewEnd];
  timeline.addEventListener("mousedown", (e) => {
    panning = true;
    panX = e.clientX;
    panRange = [viewStart, viewEnd];
  });
  window.addEventListener("mousemove", (e) => {
    if (!panning) return;
    const rect = timeline.getBoundingClientRect();
    const dx = e.clientX - panX;
    const dt = (panRange[1] - panRange[0]) * (dx / rect.width);
    let ns = panRange[0] - dt,
      ne = panRange[1] - dt;
    [viewStart, viewEnd] = clampView(ns, ne);
    render();
  });
  window.addEventListener("mouseup", () => {
    panning = false;
  });

  // ---- Minimap brush (handles + move + create) ----
  const EDGE = 8; // px threshold near edges
  const MIN_W_PX = 10; // minimum selection width in px
  let brushing = false,
    brushMode = null; // 'left'|'right'|'move'|'create'
  let brushStartX = 0,
    brushEndX = 0; // for 'create'
  let downX = 0,
    baseBx0 = 0,
    baseBx1 = 0; // for move/resize baselines

  function getBrushPixels(rect) {
    const bx0 = scaleT(viewStart, loadedStart, loadedEnd, 0, rect.width);
    const bx1 = scaleT(viewEnd, loadedStart, loadedEnd, 0, rect.width);
    return [bx0, bx1];
  }
  function commitFromPixels(rect, px0, px1) {
    const bx0 = clamp(px0, 0, rect.width - MIN_W_PX);
    const bx1 = clamp(px1, bx0 + MIN_W_PX, rect.width);
    viewStart = invScaleX(bx0, loadedStart, loadedEnd, 0, rect.width);
    viewEnd = invScaleX(bx1, loadedStart, loadedEnd, 0, rect.width);
    render();
  }

  minimap.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      const rect = minimap.getBoundingClientRect();
      const [bx0, bx1] = getBrushPixels(rect);
      downX = e.clientX;
      brushMode = null;

      if (Math.abs(e.clientX - (rect.left + bx0)) <= EDGE) {
        brushMode = "left";
      } else if (Math.abs(e.clientX - (rect.left + bx1)) <= EDGE) {
        brushMode = "right";
      } else if (e.clientX >= rect.left + bx0 && e.clientX <= rect.left + bx1) {
        brushMode = "move";
      } else {
        brushMode = "create";
        brushStartX = e.clientX;
        brushEndX = e.clientX;
      }

      baseBx0 = bx0;
      baseBx1 = bx1;
      brushing = true;
      minimap.setPointerCapture(e.pointerId);
      if (brushMode === "create") {
        commitFromPixels(rect, brushStartX - rect.left, brushEndX - rect.left);
      }
    },
    { passive: false }
  );

  minimap.addEventListener(
    "pointermove",
    (e) => {
      const rect = minimap.getBoundingClientRect();
      if (brushing) {
        e.preventDefault();
      }
      if (!brushing) {
        // hover cursor feedback
        const [bx0, bx1] = getBrushPixels(rect);
        const x = e.clientX - rect.left;
        if (Math.abs(x - bx0) <= EDGE || Math.abs(x - bx1) <= EDGE)
          minimap.style.cursor = "ew-resize";
        else if (x > bx0 && x < bx1) minimap.style.cursor = "grab";
        else minimap.style.cursor = "crosshair";
        return;
      }

      if (brushMode === "left") {
        const nx0 = clamp(e.clientX - rect.left, 0, baseBx1 - MIN_W_PX);
        commitFromPixels(rect, nx0, baseBx1);
      } else if (brushMode === "right") {
        const nx1 = clamp(
          e.clientX - rect.left,
          baseBx0 + MIN_W_PX,
          rect.width
        );
        commitFromPixels(rect, baseBx0, nx1);
      } else if (brushMode === "move") {
        const dx = e.clientX - downX;
        let nx0 = baseBx0 + dx;
        let nx1 = baseBx1 + dx;
        if (nx0 < 0) {
          nx1 -= nx0;
          nx0 = 0;
        }
        if (nx1 > rect.width) {
          const over = nx1 - rect.width;
          nx0 -= over;
          nx1 = rect.width;
        }
        commitFromPixels(rect, nx0, nx1);
      } else if (brushMode === "create") {
        brushEndX = e.clientX;
        commitFromPixels(
          rect,
          Math.min(brushStartX, brushEndX) - rect.left,
          Math.max(brushStartX, brushEndX) - rect.left
        );
      }
    },
    { passive: false }
  );

  const endBrush = (e) => {
    brushing = false;
    brushMode = null;
    minimap.releasePointerCapture?.(e.pointerId);
    minimap.style.cursor = "";
  };
  minimap.addEventListener("pointerup", endBrush);
  minimap.addEventListener("pointercancel", endBrush);
  minimap.addEventListener("pointerleave", (e) => {
    if (!brushing) minimap.style.cursor = "";
    else endBrush(e);
  });

  // ---- Pinch zoom (two-finger) ----
  let touches = new Map(),
    pinchBase = null;
  timeline.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") e.preventDefault();
    if (e.pointerType === "mouse") return;
    timeline.setPointerCapture(e.pointerId);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      const pts = Array.from(touches.values());
      const rect = timeline.getBoundingClientRect();
      const midX = (pts[1].x + pts[0].x) / 2 - rect.left;
      const dx = pts[1].x - pts[0].x;
      pinchBase = { span: viewEnd - viewStart, dist: Math.abs(dx), midX };
    }
  });
  timeline.addEventListener(
    "pointermove",
    (e) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (e.pointerType === "mouse") return;
      if (touches.size === 2 && pinchBase) {
        e.preventDefault();
        const rect = timeline.getBoundingClientRect();
        const GUT = (getComputedStyle(document.documentElement).getPropertyValue('--gutter') || '').trim();
        const gutPx = parseFloat(GUT) || 140;
        const pts = Array.from(touches.values());
        const dist = Math.abs(pts[1].x - pts[0].x);
        const zoom = clamp(dist / (pinchBase.dist || 1), 0.2, 5);
        const span = clamp(
          pinchBase.span / zoom,
          15 * 60 * 1000,
          dataEnd - dataStart
        );
        const centerT = invScaleX(
          pinchBase.midX,
          viewStart,
          viewEnd,
          gutPx,
          rect.width
        );
        let ns = centerT - 0.5 * span,
          ne = ns + span;
        [viewStart, viewEnd] = clampView(ns, ne);
        render();
      }
    },
    { passive: false }
  );
  const endTouch = (e) => {
    if (touches.has(e.pointerId)) touches.delete(e.pointerId);
    if (touches.size < 2) pinchBase = null;
  };
  timeline.addEventListener("pointerup", endTouch);
  timeline.addEventListener("pointercancel", endTouch);
  timeline.addEventListener("pointerleave", endTouch);

  // ---- Resize/theme awareness ----
  window.addEventListener("resize", () => {
    TOK = readTokens();
    render();
  });

  // Duration chips
  durationChips.forEach((btn) => {
    btn.addEventListener("click", () => {
      durationChips.forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      period.durationKey = btn.dataset.duration;
      periodTime.style.display = DUR[period.durationKey] < DAY ? "" : "none";
      updatePeriodPreview();
    });
  });

  // Anchor chips
  anchorChips.forEach((btn) => {
    btn.addEventListener("click", () => {
      anchorChips.forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      period.anchor = btn.dataset.anchor;
      updatePeriodPreview();
    });
  });

  // Date/time inputs
  periodDate.addEventListener("change", () => {
    const t = periodTime.value;
    period.at = combineDateTime(
      periodDate.value,
      DUR[period.durationKey] < DAY ? t : "00:00"
    );
    updatePeriodPreview();
  });
  periodTime.addEventListener("change", () => {
    period.at = combineDateTime(periodDate.value, periodTime.value || "00:00");
    updatePeriodPreview();
  });

  // Apply — set loaded extent and reset view to it
  applyBtn.addEventListener("click", () => {
    const dur = DUR[period.durationKey];
    const subDay = dur < DAY;
    const baseDate = period.at;
    let start, end;
    if (period.anchor === "start") {
      if (subDay) {
        start = baseDate;
        end = new Date(start.getTime() + dur);
      } else {
        const s = dayStart(baseDate);
        start = s;
        end = new Date(s.getTime() + dur);
      }
    } else {
      if (subDay) {
        end = baseDate;
        start = new Date(end.getTime() - dur);
      } else {
        const e = dayStart(baseDate).getTime() + DAY;
        end = new Date(e);
        start = new Date(e - dur);
      }
    }
    // Clamp to mock data availability
    loadedStart = Math.max(dataStart, +start);
    loadedEnd = Math.min(dataEnd, +end);
    if (loadedEnd <= loadedStart) {
      loadedStart = +start;
      loadedEnd = +end;
    } // in case outside mock range

    viewStart = loadedStart;
    viewEnd = loadedEnd;
    render();
  });

  // ---- First paint ----
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(render);
  } else {
    render();
  }
})();
