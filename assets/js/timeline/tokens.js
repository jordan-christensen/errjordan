// tokens.ts
// Theme tokens read from CSS custom properties, with sensible fallbacks.

/**
 * Read a CSS variable from the provided document element, trying multiple names.
 * This allows backwards-compatibility with older prototype variable names.
 */
function readVar(s, names, fallback) {
  for (const n of names) {
    const v = s.getPropertyValue(n).trim();
    if (v) return v;
  }
  return fallback;
}

/**
 * Reads theme tokens from CSS custom properties.
 *
 * You can define these in your app CSS, for example:
 *
 * :root {
 *   --grid-line: #e5e7eb;
 *   --tone-muted: #a1a1aa;
 *   --color-nominal: #64748b;
 *   --color-confirmed: #16a34a;
 *   --color-unexpected: #dc2626;
 *   --color-missing: #a1a1aa;
 *   --row-alt: #fafafa;
 *   --text: #0f172a;
 *   --brush-fill: rgba(59,130,246,0.15);
 *   --brush-stroke: #2563eb;
 * }
 */
export function readTokens(doc = document) {
  const s = getComputedStyle(doc.documentElement);

  return {
    // grid & muted lines
    grid: readVar(s, ["--grid-line"], "#e5e7eb"),
    muted: readVar(s, ["--tone-muted"], "#a1a1aa"),

    // span kinds (solids, with fallbacks to older prototype names)
    nominal:   readVar(s, ["--color-nominal", "--color-verified"], "#64748b"),
    confirmed: readVar(s, ["--color-confirmed", "--color-manual"], "#16a34a"),
    unexpected:readVar(s, ["--color-unexpected"], "#dc2626"),
    missing:   readVar(s, ["--color-missing"], "#a1a1aa"),

    // optional gradients (used if present; otherwise solids above are used)
    nominalGradStart:    readVar(s, ["--grad-nominal-start"],   ""),
    nominalGradEnd:      readVar(s, ["--grad-nominal-end"],     ""),
    confirmedGradStart:  readVar(s, ["--grad-confirmed-start"], ""),
    confirmedGradEnd:    readVar(s, ["--grad-confirmed-end"],   ""),
    unexpectedGradStart: readVar(s, ["--grad-unexpected-start"],""),
    unexpectedGradEnd:   readVar(s, ["--grad-unexpected-end"],  ""),
    missingGradStart:    readVar(s, ["--grad-missing-start"],   ""),
    missingGradEnd:      readVar(s, ["--grad-missing-end"],     ""),

    // backgrounds & text
    bgAlt: readVar(s, ["--row-alt"], "#fafafa"),
    text:  readVar(s, ["--text"],   "#0f172a"),

    // selection brush (minimap/view window)
    brush:       readVar(s, ["--brush-fill"],   "rgba(59,130,246,0.15)"),
    brushStroke: readVar(s, ["--brush-stroke"], "#2563eb"),

    // gauge rows
    gaugeStroke: readVar(s, ["--gauge-stroke"], "#0ea5e9"),
    gaugeFillStart: readVar(s, ["--gauge-fill-start"], "rgba(14,165,233,0.25)"),
    gaugeFillEnd: readVar(s, ["--gauge-fill-end"], "rgba(14,165,233,0.04)"),
  };
}

export default readTokens;
