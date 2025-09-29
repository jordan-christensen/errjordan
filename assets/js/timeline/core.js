// core.js
import { drawTimeline } from "./renderer/timeline_renderer";
import { drawMinimap } from "./renderer/minimap_renderer";
import { readTokens } from "./tokens";
import { readLayoutVars } from "./layout";
import { clampView } from "./state";

export function createTimelineCore(opts) {
  const state = {
    rows: opts.rows,
    dataExtent: opts.dataExtent,
    view: opts.view,
    tokens: readTokens(),
    layout: readLayoutVars(),
    rowCount: opts.rows.length,
  };

  const getState = () => state;

  const render = () => {
    state.rowCount = state.rows.length;
    drawTimeline(opts.timelineCanvas, state);
    drawMinimap(opts.minimapCanvas, state);
  };

  const setView = (view, opts = {}) => {
    state.view = clampView(state, view.start, view.end);
    render();
    return state.view;
  };

  const resetRows = (rows) => {
    state.rows = rows;
    state.rowCount = rows.length;
    render();
  };

  const setDataExtent = (extent) => {
    state.dataExtent = extent;
    state.view = clampView(state, state.view.start, state.view.end);
    render();
  };

  const setTokensAndLayout = () => {
    state.tokens = readTokens();
    state.layout = readLayoutVars();
    render();
  };

  const cleanups = [];
  const destroy = () => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {}
    }
  };

  render();

  return {
    getState,
    setView,
    resetRows,
    setDataExtent,
    setTokensAndLayout,
    render,
    destroy,
  };
}
