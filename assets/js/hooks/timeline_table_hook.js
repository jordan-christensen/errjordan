// assets/js/hooks/timeline_table_hook.js
import { createTimelineCore } from "../timeline/core";
import {
  attachWheelZoom,
  attachDragPan,
  attachMinimapBrush,
} from "../timeline/interaction";

export const TimelineTableHook = {
  mounted() {
    const el = this.el;
    const timeline = el.querySelector("#timeline");
    const minimap = el.querySelector("#minimap");

    const rows = JSON.parse(el.dataset.rows || "[]");
    const extent = JSON.parse(el.dataset.extent || "{}");
    const view = JSON.parse(el.dataset.view || "{}");
    const syncView = (el.dataset.syncView || "").toLowerCase() === "true";

    this.core = createTimelineCore({
      timelineCanvas: timeline,
      minimapCanvas: minimap,
      rows,
      dataExtent: extent,
      view,
    });

    let pushTimer;
    const queueViewPush = (nextView) => {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(
        () => this.pushEvent("timeline:view_changed", nextView),
        120
      );
    };

    if (syncView) {
      const originalSetView = this.core.setView;
      this.core.setView = (v, opts = {}) => {
        const result = originalSetView(v, opts);
        if (!opts.silent) {
          queueViewPush({ ...this.core.getState().view });
        }
        return result;
      };
    }

    // server → client
    this.handleEvent("timeline:reset_rows", ({ rows }) =>
      this.core.resetRows(rows)
    );
    this.handleEvent("timeline:set_extent", ({ start, end }) =>
      this.core.setDataExtent({ start, end })
    );
    this.handleEvent("timeline:set_view", ({ start, end }) =>
      this.core.setView({ start, end }, { silent: true })
    );

    // Optional: throttle client→server view sync (uncomment if/when you want it)
    // let t;
    // const pushView = (view) => {
    //   clearTimeout(t);
    //   t = setTimeout(() => this.pushEvent("timeline:view_changed", view), 80);
    // };
    // const wrapSetView = this.core.setView;
    // this.core.setView = (v) => { wrapSetView(v); /* pushView(this.core.getState().view); */ };

    const detach = [
      attachWheelZoom(timeline, this.core),
      attachDragPan(timeline, this.core),
      attachMinimapBrush(minimap, this.core),
    ];
    this._detach = () => detach.forEach((fn) => fn && fn());
    this._clearSync = () => clearTimeout(pushTimer);
  },

  destroyed() {
    this._detach?.();
    this.core?.destroy?.();
    this._clearSync?.();
  },
};
