// A minimal stand-in for terra-v6's terra-graph.js, so the extraction guards
// can be tested without a checkout of that repo beside this one.
//
// It carries the same *structure* the extractor depends on — both marker pairs,
// and the three DOM reads byte-for-byte — with a trivial body. What it proves is
// that the guards fire; whether the real renderer still matches is a separate
// test, which does need the real file.
//
// Prettier is told to leave this file alone (.prettierignore): the extractor
// matches these snippets literally, so reformatting them silently disarms the
// tests. If extract-option-builder.mjs stops matching, it has stopped matching
// the renderer too — copy the changed snippet across from there.
(function (global) {
  function mount(host, payload, opts) {
    var env = {};

    // >>> terra-graph:option-builder — pure from here to the end marker.
    var cssVars = function () {
      var style = getComputedStyle(host);
      var fallback = payload.theme || {};
      return {
        bg:   style.getPropertyValue("--background-color").trim() || fallback.bg,
        line: style.getPropertyValue("--line-color").trim() || fallback.line,
        text: style.getPropertyValue("--text-color").trim() || fallback.text,
        tick: style.getPropertyValue("--tick-color").trim() || fallback.tick,
        chartType: (style.getPropertyValue("--chart-type").trim() || payload.chartType) === "bar" ? "bar" : "line"
      };
    };

    function rgb(color) {
      var probe = document.createElement("canvas").getContext("2d");
      probe.fillStyle = color;
      var hex = probe.fillStyle; // normalized #rrggbb
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }

    function baseOption(t) {
      return {
        backgroundColor: "transparent",
        textStyle: { fontFamily: getComputedStyle(host).fontFamily },
      };
    }

    function buildOption() {
      var t = cssVars();
      return Object.assign(baseOption(t), { series: [], __probe: rgb(t.line) });
    }
    // <<< terra-graph:option-builder

    // >>> terra-graph:option-builder-helpers — shared with the header.
    function statFmt(v) {
      if (v == null) return "–";
      var n = Number(v);
      return Math.abs(n) >= 10 ? Math.round(n).toLocaleString() : (Math.round(n * 10) / 10).toString();
    }
    function formatDuration(v, unit) {
      if (v == null) return "–";
      v = Number(v);
      if (unit === "h") { var t = Math.round(v * 60); return Math.floor(t / 60) + "h " + (t % 60) + "m"; }
      if (unit === "m") return Math.round(v) + "m";
      return Math.round(v) + "s";
    }
    // <<< terra-graph:option-builder-helpers

    return { option: buildOption(), statFmt: statFmt, formatDuration: formatDuration };
  }

  global.TerraGraph = { mount: mount };
})(this);
