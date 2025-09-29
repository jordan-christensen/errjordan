// layout.js
// Read layout variables from CSS custom properties (with fallbacks)

function num(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function str(v, fallback) {
  const s = (v || "").toString().trim()
  return s.length ? s : fallback
}

export function readLayoutVars(doc = document) {
  const s = getComputedStyle(doc.documentElement)
  return {
    gutter:    num(s.getPropertyValue("--gutter"))     || 140,
    rowBase:   num(s.getPropertyValue("--row-h-base")) || 28,
    rowScale:  num(s.getPropertyValue("--row-scale"))  || 1,
    fontAxis:  str(s.getPropertyValue("--font-axis"),  "12px"),
    fontRow:   str(s.getPropertyValue("--font-row"),   "12px"),
    labelStack: (parseInt(s.getPropertyValue("--row-label-stack")) || 0) === 1,
    rowHeights: {
      default: num(s.getPropertyValue("--row-h-default")) || 0,
      valve: num(s.getPropertyValue("--row-h-valve")) || 0,
      gauge: num(s.getPropertyValue("--row-h-gauge")) || 0,
    },
  }
}

export default readLayoutVars
