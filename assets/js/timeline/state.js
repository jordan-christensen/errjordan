// state.js
const MIN_SPAN = 15 * 60 * 1000 // 15 min

export function clampView(state, ns, ne) {
  const maxSpan = state.dataExtent.end - state.dataExtent.start
  const span = Math.max(MIN_SPAN, Math.min(ne - ns, Math.max(MIN_SPAN, maxSpan)))
  if (ns < state.dataExtent.start) {
    ns = state.dataExtent.start
    ne = ns + span
  }
  if (ne > state.dataExtent.end) {
    ne = state.dataExtent.end
    ns = ne - span
  }
  return { start: ns, end: ne }
}

export function zoomAroundPixel(state, zoom, mx, width) {
  const center = state.view.start + (mx / width) * (state.view.end - state.view.start)
  const span = Math.max(
    MIN_SPAN,
    Math.min(
      (state.view.end - state.view.start) * zoom,
      state.dataExtent.end - state.dataExtent.start
    )
  )
  const ns = center - span * (mx / width)
  const ne = ns + span
  return clampView(state, ns, ne)
}

export function shiftByFrac(state, frac) {
  const span = state.view.end - state.view.start
  return clampView(state, state.view.start + span * frac, state.view.end + span * frac)
}
