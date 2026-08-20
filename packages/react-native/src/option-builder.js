/**
 * GENERATED — do not edit. Run scripts/extract-option-builder.mjs.
 *
 * Copied verbatim from Terra's web renderer (terra-v6 terra-graph.js) between
 * its `terra-graph:option-builder` markers, with three DOM reads replaced:
 *   - theme read (getComputedStyle on the host element)
 *   - colour normalisation (canvas fillStyle probe)
 *   - chart font (computed style of the host)
 *
 * Editing this file by hand makes the native chart differ from the web one,
 * which is indistinguishable from a data bug. Change the renderer instead.
 */

/**
 * Builds an ECharts option from a Terra graph payload.
 *
 * @param {object} payload  the chart payload, from `?format=json`
 * @param {{echarts: object, theme?: object, fontFamily?: string}} env
 */
export function buildChartOption(payload, env) {
  env = env || {};
  if (!env.fontFamily) env.fontFamily = "System";
  // The builder reaches for echarts.graphic.LinearGradient, so the caller
  // supplies the instance rather than this module importing a second copy.
  var echarts = env.echarts;
  {
    // a pure function of (payload, theme). @tryterra/graphs-react-native extracts it
    // verbatim to draw the same charts without a DOM (see that package's
    // scripts/extract-option-builder.mjs). Keep it DOM-free: a `document` or
    // `window` reference here silently breaks the native renderer, and its
    // extraction test is what catches that.
    // On the web the live theme comes from CSS custom properties; here the
    // caller passes it in, with the payload's own theme as the fallback.
    var cssVars = function () {
      var fallback = payload.theme || {};
      var o = env.theme || {};
      return {
        bg:   o.bg   || fallback.bg,
        line: o.line || fallback.line,
        text: o.text || fallback.text,
        tick: o.tick || fallback.tick,
        chartType: (o.chartType || payload.chartType) === "bar" ? "bar" : "line"
      };
    };

    // The web build normalises any CSS colour through a canvas. Off-DOM we parse
    // the forms the payload and the dashboard's theme presets produce: 3-, 6- and
    // 8-digit hex (alpha ignored, as the canvas probe did) and rgb()/rgba() with
    // either comma or space separators. Anything else — a named colour, hsl() —
    // falls back to mid-grey, which is visible but never wrong-looking. Only a
    // complete triple is returned: a partial one would yield
    // "rgba(56,undefined,undefined,0.88)" downstream, silently.
    function rgb(color) {
      var s = String(color || "").trim();
      var m = /^#([0-9a-f]{3})$/i.exec(s);
      if (m) return m[1].split("").map(function (c) { return parseInt(c + c, 16); });
      m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(s);
      if (m) return [0, 2, 4].map(function (i) { return parseInt(m[1].slice(i, i + 2), 16); });
      m = /^rgba?\(([^)]+)\)$/i.exec(s);
      if (m) {
        var parts = m[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 3).map(function (p) { return parseInt(p, 10); });
        if (parts.length === 3 && parts.every(function (n) { return !isNaN(n); })) return parts;
      }
      return [127, 127, 127];
    }

    // Translucent color over whatever is behind it.
    function alpha(color, a) {
      var c = rgb(color);
      return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
    }

    // Opaque blend of `color` toward the card background by `frac` — used for
    // legend swatches that must stay visible (alpha fills are too faint to
    // read at swatch size).
    function blend(color, frac) {
      var c = rgb(color), bg = rgb(cssVars().bg);
      var m = function (i) { return Math.round(c[i] * frac + bg[i] * (1 - frac)); };
      return "rgb(" + m(0) + "," + m(1) + "," + m(2) + ")";
    }

    function fmt(v) {
      if (v == null) return "–";
      var n = Number(v);
      if (Math.abs(n) >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    function axisCommon(t) {
      return {
        axisLine: { lineStyle: { color: alpha(t.tick, 0.55) } },
        axisTick: { show: false },
        axisLabel: { color: alpha(t.text, 0.6), fontSize: 11 },
        splitLine: { lineStyle: { color: alpha(t.tick, 0.18) } }
      };
    }

    function baseOption(t) {
      return {
        animationDuration: 400,
        animationEasing: "cubicOut",
        backgroundColor: "transparent",
        grid: { left: 8, right: 14, top: 18, bottom: 4, containLabel: true },
        textStyle: { fontFamily: env.fontFamily },
        tooltip: {
          trigger: "axis",
          backgroundColor: alpha(t.bg, 0.96),
          borderColor: alpha(t.tick, 0.4),
          borderWidth: 1,
          padding: [8, 12],
          textStyle: { color: t.text, fontSize: 12 },
          axisPointer: { type: "line", lineStyle: { color: alpha(t.line, 0.5), width: 1 } },
          valueFormatter: function (v) { return fmt(v) + (payload.unit ? " " + payload.unit : ""); }
        }
      };
    }

    function seriesPoints(s) {
      return s.points.map(function (p) { return [p.x, p.y]; });
    }

    function labelOpt(t, s) {
      if (!payload.showLabels) return { show: false };
      return {
        show: true, position: "top", fontSize: 10, fontWeight: 600,
        color: t.text,
        backgroundColor: alpha(t.bg, 0.75),
        padding: [2, 4], borderRadius: 4,
        formatter: function (p) {
          if (s && s.format === "duration") {
            var dv = Array.isArray(p.value) ? p.value[1] : p.value;
            return dv == null ? "" : formatDuration(dv, s.unit);
          }
          return p.value[1] == null ? "" : fmt(p.value[1]);
        }
      };
    }

    // Distinct colors for a multi-metric combo; the first series uses the
    // theme line color so single-metric and the primary series stay on-brand.
    var EXTRA_HUES = ["#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#6366F1"];
    function seriesColor(t, i) {
      return i === 0 ? t.line : EXTRA_HUES[(i - 1) % EXTRA_HUES.length];
    }

    // metricOption renders one or more metric series as a line/bar combo.
    // Summary metrics share a per-day category axis so multiple bars can group
    // (side by side) or stack; a samples metric uses a continuous time axis.
    // A single series honors the live --chart-type CSS var so the dashboard
    // preview can flip it; multiple series keep their own type, color, and a
    // unit-based y-axis.
    // panelOption stacks each metric in its own grid sharing the x-axis: the
    // primary metric on top (taller), secondaries below — the design's HR
    // line + activity-bars overlay.
    function panelOption(t) {
      var category = payload.xMode === "category";
      var N = payload.panelCount;
      var weights = payload.series.map(function (_, i) { return i === 0 ? 2 : 1; });
      var totalW = weights.reduce(function (a, b) { return a + b; }, 0);
      var topPct = 4, botPct = 7, gapPct = 8;
      var avail = 100 - topPct - botPct - gapPct * (N - 1);
      var hs = weights.map(function (w) { return avail * w / totalW; });
      var tops = [], acc = topPct;
      hs.forEach(function (h) { tops.push(acc); acc += h + gapPct; });

      var grids = [], xAxes = [], yAxes = [], titles = [];
      payload.series.forEach(function (s, i) {
        var last = i === N - 1;
        grids.push({ left: 6, right: 30, top: tops[i] + "%", height: hs[i] + "%", containLabel: true });
        xAxes.push(Object.assign(axisCommon(t), {
          gridIndex: i, type: category ? "category" : "time",
          data: category ? payload.categories : undefined, boundaryGap: category,
          axisTick: { show: false }, splitLine: { show: false },
          axisLabel: last ? { color: alpha(t.text, 0.6), fontSize: 11, hideOverlap: true,
            formatter: category ? undefined : timeAxisFormatter() } : { show: false }
        }));
        yAxes.push(Object.assign(axisCommon(t), {
          gridIndex: i, type: "value", scale: true, position: "right", axisLine: { show: false },
          name: s.unit || "", nameLocation: "end", nameGap: 4,
          nameTextStyle: { color: alpha(t.text, 0.4), fontSize: 9, align: "right" },
          splitLine: { lineStyle: { color: alpha(t.text, 0.08) } }
        }));
        if (i > 0) titles.push({ text: s.name, left: "center", top: (tops[i] - 4.5) + "%",
          textStyle: { fontSize: 11, fontWeight: "normal", color: alpha(t.text, 0.55) } });
      });

      var seriesList = payload.series.map(function (s, i) {
        var color = seriesColor(t, i);
        var data = category ? s.values : seriesPoints(s);
        var common = { name: s.name, data: data, xAxisIndex: i, yAxisIndex: i };
        if (s.chartType === "bar") {
          // Thin flat spikes (not wide rounded bars) for the design's
          // fine-grained activity/steps distribution in a secondary panel.
          return Object.assign(common, { type: "bar", barMaxWidth: 6, barMinWidth: 1,
            itemStyle: { borderRadius: 0, color: alpha(color, 0.85) } });
        }
        return Object.assign(common, { type: "line", smooth: 0.25, showSymbol: false, connectNulls: false,
          lineStyle: { width: 2.2, color: color }, itemStyle: { color: color },
          areaStyle: i === 0 ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: alpha(color, 0.22) }, { offset: 1, color: alpha(color, 0.02) }]) } : undefined });
      });

      return Object.assign(baseOption(t), {
        title: titles,
        tooltip: { trigger: "axis", backgroundColor: alpha(t.bg, 0.96), borderColor: alpha(t.tick, 0.4), borderWidth: 1,
          padding: [8, 12], textStyle: { color: t.text, fontSize: 12 } },
        axisPointer: { link: [{ xAxisIndex: "all" }] },
        grid: grids, xAxis: xAxes, yAxis: yAxes, series: seriesList,
        toolbox: { show: false }
      });
    }

    function metricOption(t) {
      if (payload.panelMode === "panels" && payload.panelCount > 1) return panelOption(t);
      var single = payload.series.length === 1;
      var category = payload.xMode === "category";
      var stacked = payload.barLayout === "stacked";
      var isSamples = !category;
      var baseline = payload.baseline;
      // visualMaps tint series by value (zones on the line, the one-sided
      // baseline fill). seriesIndex is resolved by reference after the series
      // array is finalised, since whiskers unshift and the fill is appended.
      var visualMaps = [];

      // Pinch/scroll pan only — no slider scrubber ("timeline viewer"); the
      // design has none, and event pills live in that bottom strip instead.
      var zoom = [{ type: "inside", throttle: 50 }];

      // Single-metric y-axis sits on the RIGHT to match the design; multi
      // splits left/right by unit. The header already carries the unit for a
      // single metric, so its axis name is dropped to avoid a corner clash.
      var axes = (payload.axes && payload.axes.length ? payload.axes : [{ unit: "" }]).map(function (ax, i) {
        var pos = single ? "right" : (i === 0 ? "left" : "right");
        var a = Object.assign(axisCommon(t), {
          type: "value", position: pos, axisLine: { show: false },
          name: single ? "" : (ax.unit || ""), nameLocation: "end", nameGap: 6,
          nameTextStyle: { color: alpha(t.text, 0.45), fontSize: 10, align: pos === "left" ? "left" : "right" },
          splitLine: i === 0 ? { lineStyle: { color: alpha(t.text, 0.1) } } : { show: false }
        });
        if (payload.zones && payload.zones.length) {
          // Fixed HR range so all training-zone bands stay visible.
          a.min = 50; a.max = 200; a.interval = 50;
        } else {
          a.scale = single || isSamples; // tight fill for a single line
        }
        // Suppress the boundary max label: with scale/zones the exact top can
        // sit a hair below a tick and ECharts draws both, overlapping at the
        // top of the (right-positioned) single-metric axis.
        if (single) {
          a.axisLabel = Object.assign({}, a.axisLabel, { showMaxLabel: false });
        }
        return a;
      });

      var seriesList = payload.series.map(function (s, i) {
        var type = single ? cssVars().chartType : (s.chartType === "bar" ? "bar" : "line");
        var color = seriesColor(t, i);
        var data = category ? s.values : seriesPoints(s);
        var common = { name: s.name, data: data, label: labelOpt(t, s), yAxisIndex: s.axisIndex || 0 };
        if (type === "bar") {
          return Object.assign(common, {
            type: "bar",
            barMaxWidth: 28,
            stack: stacked ? "axis" + (s.axisIndex || 0) : undefined,
            z: 2,
            itemStyle: {
              borderRadius: stacked ? 0 : [6, 6, 0, 0],
              // A bar is read as height anchored to the baseline, so keep the
              // baseline solid. Grouped bars get a slight top-to-bottom sheen for
              // polish (not the old 0.65 fade, which left short bars looking
              // ghosted at the axis). Stacked segments abut with square edges —
              // a per-segment fade muddies the internal seams — so keep flat.
              color: stacked ? color : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: color }, { offset: 1, color: alpha(color, 0.88) }
              ])
            }
          });
        }
        var line = Object.assign(common, {
          type: "line", smooth: 0.25, connectNulls: false, showSymbol: false, symbolSize: 7,
          z: 3,
          lineStyle: { width: 2.2, color: color },
          itemStyle: { color: color, borderColor: t.bg, borderWidth: 2 },
          emphasis: { scale: 1.4 },
          areaStyle: single && !baseline ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: alpha(color, 0.26) }, { offset: 1, color: alpha(color, 0.02) }
            ])
          } : undefined
        });
        // With a baseline the line carries no area of its own; a dedicated
        // one-sided fill series (added in the decoration block) shades only
        // the above-baseline "good" region.
        return line;
      });

      // Which data dimension carries the plotted value: a category series is a
      // flat array of numbers, a time series is [x, y] pairs. A visualMap
      // pointed at a dimension the series doesn't have throws inside ECharts'
      // renderer, which is what a baseline on a summary metric used to do.
      var valueDim = category ? 0 : 1;

      // Decorate the primary series: baseline reference line, training-zone
      // bands, and extrema markers — all opt-in via payload flags.
      if (seriesList.length && seriesList[0].type === "line") {
        var lineSeries = seriesList[0];
        if (baseline) {
          lineSeries.markLine = {
            silent: true, symbol: "none",
            lineStyle: { color: "#36b37e", width: 1.5, type: "solid" },
            label: { show: true, position: "insideStartTop", color: "#2f9e5f", fontSize: 10,
              formatter: baseline.label + " " + (payload.series[0].format === "duration"
                ? formatDuration(baseline.value, payload.series[0].unit)
                : statFmt(baseline.value) + (payload.series[0].unit ? " " + payload.series[0].unit : "")) },
            data: [{ yAxis: baseline.value }]
          };
        }
        if (payload.zones && payload.zones.length) {
          lineSeries.markArea = {
            silent: true,
            data: payload.zones.map(function (z) {
              return [
                { yAxis: z.from, itemStyle: { color: z.color }, label: { show: true, position: "insideTopLeft", align: "left", padding: [4, 0, 0, 8], color: alpha(t.text, 0.5), fontSize: 10, formatter: z.label } },
                { yAxis: z.to }
              ];
            })
          };
          // Tint the line by zone (red in Peak, etc.) — the design's at-a-glance
          // signal — with a piecewise visualMap on the plotted value. An
          // explicit lineStyle.color would override the visualMap, so drop it.
          // Skipped with a secondary present: a chart-wide visualMap suppresses
          // the secondary grid's series (the markArea bands stay regardless).
          if (!payload.secondary) {
            delete lineSeries.lineStyle.color;
            delete lineSeries.itemStyle.color;
            visualMaps.push({
              __series: lineSeries, show: false, type: "piecewise", dimension: valueDim,
              pieces: payload.zones.map(function (z) { return { gte: z.from, lt: z.to, color: z.line }; }),
              outOfRange: { color: alpha(t.line, 0.85) }
            });
          }
        }
        if (payload.showMarkers) {
          var marks = [];
          var m = payload.markers || "both";
          var ring = { symbol: "circle", symbolSize: 9, itemStyle: { color: t.bg, borderColor: t.text, borderWidth: 2 }, label: { show: false } };
          if (m === "min" || m === "both") marks.push(Object.assign({ type: "min" }, ring));
          if (m === "max" || m === "both") marks.push(payload.zones ? { type: "max", symbol: "circle", symbolSize: 7, itemStyle: { color: "#E5484D" }, label: { show: false } } : Object.assign({ type: "max" }, ring));
          lineSeries.markPoint = { data: marks };
        }
        // Min/max range: thick rounded gradient bars behind the line (the
        // design's per-bucket range pillars), not thin ticks.
        if (payload.series[0].range && payload.series[0].range.length) {
          var ranges = payload.series[0].range, pts = payload.series[0].points;
          var wdata = ranges.map(function (r, idx) { return [pts[idx].x, r[0], r[1]]; });
          seriesList.unshift({
            type: "custom", z: 1, data: wdata, tooltip: { show: false },
            renderItem: function (params, api) {
              var x = api.coord([api.value(0), 0])[0];
              var yh = api.coord([0, api.value(2)])[1];
              var yl = api.coord([0, api.value(1)])[1];
              var w = 6;
              return { type: "rect",
                shape: { x: x - w / 2, y: yh, width: w, height: Math.max(w, yl - yh), r: w / 2 },
                style: { fill: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: alpha("#E8A33A", 0.5) }, { offset: 1, color: alpha(t.text, 0.16) }
                ]) } };
            }
          });
        }
        // One-sided baseline fill: shade only the above-baseline ("good")
        // region. The area is drawn for the whole line and clipped at the
        // baseline by a piecewise visualMap — a clamped fill left a sliver.
        // Skipped with a secondary (the visualMap would blank the secondary
        // grid); the markLine reference still shows.
        if (single && baseline && !payload.secondary) {
          var bv = baseline.value;
          var fillSeries = {
            type: "line", z: 1, yAxisIndex: lineSeries.yAxisIndex || 0,
            data: category ? (payload.series[0].values || []) : seriesPoints(payload.series[0]),
            smooth: 0.25, symbol: "none", silent: true, legendHoverLink: false, connectNulls: false,
            lineStyle: { opacity: 0 }, tooltip: { show: false },
            areaStyle: { origin: bv }
          };
          seriesList.push(fillSeries);
          // Explicit min/max: a visualMap without bounds derives them globally,
          // which clobbers a second visualMap (e.g. a sleep-stages secondary).
          var bvals = (category ? (payload.series[0].values || []) : (payload.series[0].points || []).map(function (p) { return p.y; })).filter(function (v) { return v != null; });
          var bmin = Math.min(bvals.length ? Math.min.apply(null, bvals) : bv, bv);
          var bmax = Math.max(bvals.length ? Math.max.apply(null, bvals) : bv, bv);
          visualMaps.push({
            __series: fillSeries, show: false, type: "piecewise", dimension: valueDim,
            min: bmin, max: bmax,
            // Every piece is closed at both ends: ECharts 5.5.1 throws while
            // resolving a half-open piece ("Cannot read properties of undefined
            // (reading 'coord')"), which took the whole chart down.
            pieces: [
              { gte: bv, lte: bmax, color: alpha("#36b37e", 0.18) },
              { gte: bmin, lt: bv, color: "rgba(0,0,0,0)" }
            ]
          });
        }
      }
      // Resolve visualMap targets now the series array is final (whiskers
      // unshift, fill appends), then strip the internal reference.
      visualMaps.forEach(function (vm) { vm.seriesIndex = seriesList.indexOf(vm.__series); delete vm.__series; });

      var xAxis = category
        ? Object.assign(axisCommon(t), {
            type: "category", data: payload.categories, boundaryGap: true,
            axisTick: { show: false },
            axisLabel: { color: alpha(t.text, 0.6), fontSize: 11, hideOverlap: true },
            splitLine: { show: false }
          })
        : Object.assign(axisCommon(t), {
            type: "time", splitLine: { show: false },
            axisLabel: { color: alpha(t.text, 0.6), fontSize: 11, hideOverlap: true,
              formatter: timeAxisFormatter() }
          });

      var opt = Object.assign(baseOption(t), {
        tooltip: single ? singleSeriesTooltip(t) : multiSeriesTooltip(t),
        xAxis: xAxis,
        yAxis: axes,
        dataZoom: zoom,
        series: seriesList
      });
      if (visualMaps.length) opt.visualMap = visualMaps;
      if (!single) {
        opt.legend = {
          top: 0, left: "center", icon: "roundRect", itemWidth: 12, itemHeight: 8,
          itemGap: 14, textStyle: { color: alpha(t.text, 0.7), fontSize: 11 }
        };
        opt.grid = Object.assign(baseOption(t).grid, { top: 34 });
      }
      if (payload.events && payload.events.length) {
        // Reserve a strip at the bottom for the event badges.
        opt.grid = Object.assign(opt.grid || baseOption(t).grid, { bottom: 30 });
      }
      if (payload.secondary && single) addSecondary(t, opt);
      if (payload.events && payload.events.length) addEvents(t, opt);
      return opt;
    }

    // A tooltip datum's numeric value: category series carry the value
    // directly, time series carry [x, y] pairs.
    function tipValue(p) {
      return Array.isArray(p.value) ? p.value[1] : p.value;
    }

    // The time-axis label formatter. In per-session "elapsed" scope (a workout)
    // it counts whole minutes from the session start; otherwise it labels clock
    // time within the level, deferring to ECharts' date templating.
    function elapsedMinutes(ms) {
      return Math.round((ms - new Date(payload.rangeStart).getTime()) / 60000);
    }
    // Single-letter weekday by Date.getDay() (0=Sun). The server (alignToCategories)
    // labels category axes the same way; keep the two in sync.
    var WEEKDAY1 = ["S", "M", "T", "W", "T", "F", "S"];
    function timeAxisFormatter() {
      if (payload.axisMode === "elapsed") {
        return function (val) { return elapsedMinutes(val) + "m"; };
      }
      // Short windows label day-boundary ticks with a two-line tick — weekday
      // initial over day-of-month ("M\n1") — while intraday ticks keep clock
      // time. ECharts has no weekday token, so this is a function.
      if (payload.weekdayAxis) {
        return function (val) {
          var d = new Date(val);
          return (d.getHours() === 0 && d.getMinutes() === 0)
            ? WEEKDAY1[d.getDay()] + "\n" + d.getDate()
            : ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
        };
      }
      return { day: "{MMM} {d}", hour: "{HH}:{mm}", minute: "{HH}:{mm}" };
    }

    // The tooltip time/date line: a day label for a category (per-day) axis,
    // a bare time (19:48) within a single day, and date + time across days —
    // so an intraday graph never repeats the date and a multi-day one never
    // loses it.
    var TIP_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function tipTime(p) {
      if (payload.xMode === "category") return p.axisValueLabel || "";
      var d = new Date(p.axisValue);
      if (isNaN(d.getTime())) return p.axisValueLabel || "";
      if (payload.axisMode === "elapsed") return elapsedMinutes(d.getTime()) + " min";
      var hm = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
      return payload.singleDay ? hm : d.getDate() + " " + TIP_MON[d.getMonth()] + ", " + hm;
    }

    // Single-series tooltip (matches the design callout): the value + unit lead
    // in bold, the time/date sits dimmed beneath. Multi-series leads with the
    // shared time, then one bold value per series.
    function singleSeriesTooltip(t) {
      var s0 = payload.series[0] || {}, unit = s0.unit, fmt = s0.format;
      return Object.assign(baseOption(t).tooltip, {
        formatter: function (params) {
          var p = params[0];
          if (!p) return "";
          var val = fmt === "duration"
            ? formatDuration(tipValue(p), unit)
            : statFmt(tipValue(p)) + (unit ? " <span style='opacity:.55;font-weight:400'>" + unit + "</span>" : "");
          return "<div style='font-weight:600;font-size:13px;line-height:1.2'>" + val + "</div>" +
            "<div style='opacity:.55;font-size:11px;margin-top:1px'>" + tipTime(p) + "</div>";
        }
      });
    }

    function multiSeriesTooltip(t) {
      var metaByName = {};
      payload.series.forEach(function (s) { metaByName[s.name] = { unit: s.unit, format: s.format }; });
      return Object.assign(baseOption(t).tooltip, {
        formatter: function (params) {
          var head = "<div style='opacity:.55;font-size:11px;margin-bottom:3px'>" + (params[0] ? tipTime(params[0]) : "") + "</div>";
          var rows = params.filter(function (p) { return tipValue(p) != null; }).map(function (p) {
            var m = metaByName[p.seriesName] || {};
            var val = m.format === "duration"
              ? "<b>" + formatDuration(tipValue(p), m.unit) + "</b>"
              : "<b>" + statFmt(tipValue(p)) + "</b>" + (m.unit ? "<span style='opacity:.55'> " + m.unit + "</span>" : "");
            return p.marker + p.seriesName + " " + val;
          }).join("<br>");
          return head + rows;
        }
      });
    }

    // A stacked invisible base + a filled delta produce the band; legendColor
    // is an opaque swatch color (the area fill is too faint to see in a
    // legend chip).
    function bandSeries(name, base, delta, areaColor, legendColor) {
      return [
        { name: name + "-base", type: "line", stack: name, data: base, lineStyle: { opacity: 0 }, symbol: "none", silent: true, tooltip: { show: false }, legendHoverLink: false },
        { name: name, type: "line", stack: name, data: delta, lineStyle: { opacity: 0 }, symbol: "none", silent: true,
          areaStyle: { color: areaColor }, itemStyle: { color: legendColor }, tooltip: { show: false } }
      ];
    }

    function agpOption(t) {
      var a = payload.agp;
      var d90 = a.p90.map(function (v, i) { return +(v - a.p10[i]).toFixed(2); });
      var d75 = a.p75.map(function (v, i) { return +(v - a.p25[i]).toFixed(2); });
      // Opaque, clearly-distinct legend swatches; the on-chart band fills
      // stay subtle (alpha) but the legend reads at chip size.
      var band90 = blend(t.line, 0.28);
      var band75 = blend(t.line, 0.58);
      var opt = Object.assign(baseOption(t), {
        legend: {
          top: 0, right: 40, icon: "roundRect", itemWidth: 14, itemHeight: 8,
          textStyle: { color: alpha(t.text, 0.7), fontSize: 11 },
          data: ["10–90%", "25–75%", "Median"]
        },
        xAxis: Object.assign(axisCommon(t), { type: "category", boundaryGap: false, data: a.hours,
          axisLabel: { color: alpha(t.text, 0.6), fontSize: 11, interval: 3 } }),
        yAxis: Object.assign(axisCommon(t), { type: "value", scale: true, axisLine: { show: false },
          splitLine: { lineStyle: { color: alpha(t.text, 0.1) } } }),
        series: bandSeries("10–90%", a.p10, d90, alpha(t.line, 0.14), band90)
          .concat(bandSeries("25–75%", a.p25, d75, alpha(t.line, 0.32), band75))
          .concat([
            { name: "Median", type: "line", data: a.p50, smooth: 0.3, symbol: "none",
              lineStyle: { width: 3, color: t.line }, itemStyle: { color: t.line }, z: 5 }
          ]),
        tooltip: Object.assign(baseOption(t).tooltip, {
          formatter: function (params) {
            var hour = params[0] && params[0].axisValue;
            var byName = {};
            params.forEach(function (p) { byName[p.seriesName] = p; });
            var i = params[0].dataIndex;
            return "<b>" + hour + "</b><br>" +
              "90% · " + fmt(a.p90[i]) + "<br>" +
              "75% · " + fmt(a.p75[i]) + "<br>" +
              "<b>50% · " + fmt(a.p50[i]) + "</b><br>" +
              "25% · " + fmt(a.p25[i]) + "<br>" +
              "10% · " + fmt(a.p10[i]) +
              (payload.unit ? "<span style='opacity:.6'> " + payload.unit + "</span>" : "");
          }
        })
      });
      return opt;
    }

    function macroOption(t) {
      var m = payload.macro;
      var palette = { carbs: "#5CC887", fat: "#FFD13F", protein: "#FF6D66" };
      function bar(name, data, color, isTop) {
        return {
          name: name, type: "bar", stack: "macros", data: data,
          barMaxWidth: 30,
          itemStyle: { color: color, borderRadius: isTop ? [6, 6, 0, 0] : 0 },
          label: payload.showLabels
            ? { show: true, fontSize: 9, fontWeight: 600, color: "#1a1a1a",
                formatter: function (p) { return p.value ? Math.round(p.value) : ""; } }
            : { show: false }
        };
      }
      return Object.assign(baseOption(t), {
        legend: { top: 0, right: 40, textStyle: { color: alpha(t.text, 0.7), fontSize: 11 } },
        xAxis: Object.assign(axisCommon(t), { type: "category", data: m.days,
          axisLabel: { color: alpha(t.text, 0.6), fontSize: 11,
            formatter: function (d) { return d.slice(5).replace("-", "/"); } } }),
        yAxis: [
          Object.assign(axisCommon(t), { type: "value", name: "g",
            nameTextStyle: { color: alpha(t.text, 0.45) }, axisLine: { show: false } }),
          { type: "value", show: false }
        ],
        series: [
          bar("Carbs", m.carbs, palette.carbs, false),
          bar("Fat", m.fat, palette.fat, false),
          bar("Protein", m.protein, palette.protein, true),
          { name: "Calories", type: "line", yAxisIndex: 1, data: m.calories,
            smooth: 0.3, symbol: "circle", symbolSize: 5,
            lineStyle: { width: 2, color: t.line }, itemStyle: { color: t.line } }
        ],
        tooltip: Object.assign(baseOption(t).tooltip, {
          // Macros are grams, calories are kcal — disambiguate per row.
          valueFormatter: undefined,
          formatter: function (params) {
            var head = "<span style='opacity:.6'>" + (params[0] ? params[0].axisValueLabel : "") + "</span>";
            var rows = params.map(function (p) {
              var unit = p.seriesName === "Calories" ? " kcal" : " g";
              return p.marker + p.seriesName + " <b>" + fmt(p.value) + "</b><span style='opacity:.6'>" + unit + "</span>";
            }).join("<br>");
            return head + "<br>" + rows;
          }
        })
      });
    }

    var SLEEP_PALETTE = ["#26382b", "#527a5d", "#66cc81", "#9efab7"]; // Deep,Light,REM,Awake (level 0..3) — Figma palette
    // The hypnogram draws each epoch as a discrete fixed-thickness chunk at its
    // stage row (Deep bottom … Awake top), with a thin vertical connector at
    // every stage transition — matching the design. A custom series positioned
    // from params.coordSys (not api.coord, which ignores the grid index) so it
    // renders identically standalone and as a secondary sub-graph.
    function hypnogramSeries(t, ep, times, lastT, step, idx) {
      var tMin = times[0], tMax = lastT + step, span = (tMax - tMin) || 1;
      return {
        type: "custom", data: ep, xAxisIndex: idx || 0, yAxisIndex: idx || 0, z: 2,
        renderItem: function (params) {
          var cs = params.coordSys, i = params.dataIndex, lvl = ep[i].level;
          var rowH = cs.height / 4, chunkH = Math.min(13, rowH * 0.6);
          var rowY = function (l) { return cs.y + cs.height - (l + 0.5) * rowH; };
          var x0 = cs.x + cs.width * (times[i] - tMin) / span;
          var x1 = cs.x + cs.width * ((i + 1 < times.length ? times[i + 1] : tMax) - tMin) / span;
          var yc = rowY(lvl);
          var kids = [{ type: "rect", shape: { x: x0, y: yc - chunkH / 2, width: Math.max(1, x1 - x0), height: chunkH, r: 2 }, style: { fill: SLEEP_PALETTE[lvl] } }];
          if (i + 1 < ep.length && ep[i + 1].level !== lvl) {
            var nyc = rowY(ep[i + 1].level);
            var top = Math.min(yc, nyc) - chunkH / 2, bot = Math.max(yc, nyc) + chunkH / 2;
            kids.push({ type: "rect", shape: { x: x1 - 1.25, y: top, width: 2.5, height: bot - top }, style: { fill: SLEEP_PALETTE[Math.max(lvl, ep[i + 1].level)] } });
          }
          return { type: "group", children: kids };
        }
      };
    }
    function sleepYAxis(t, idx) {
      return {
        type: "category", data: ["D", "L", "R", "A"], position: "right", gridIndex: idx || 0,
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: alpha(t.text, 0.45), fontSize: 9 }
      };
    }
    function sleepOption(t) {
      var ep = payload.sleep.epochs;
      if (!ep || !ep.length) return baseOption(t);
      var times = ep.map(function (e) { return new Date(e.x).getTime(); });
      var lastT = times[times.length - 1];
      var step = ep.length > 1 ? (times[1] - times[0]) : 20 * 60000;
      var o = Object.assign(baseOption(t), {
        tooltip: { show: false },
        toolbox: { show: false },
        grid: { left: 6, right: 28, top: 10, bottom: 22, containLabel: true },
        xAxis: Object.assign(axisCommon(t), {
          type: "time", min: times[0], max: lastT + step, splitLine: { show: false },
          axisLabel: { color: alpha(t.text, 0.6), fontSize: 10, formatter: { day: "{HH}:{mm}", hour: "{HH}:{mm}" } }
        }),
        yAxis: sleepYAxis(t, 0),
        series: [hypnogramSeries(t, ep, times, lastT, step, 0)]
      });
      return o;
    }

    // addSecondary shrinks the primary into a top grid and stacks a compact
    // secondary sub-graph (sleep hypnogram or a metric) beneath it, sharing the
    // x-axis. Proportions mirror the design: the primary is ~3x the secondary,
    // the secondary is lightly annotated, and the two x-axes are linked.
    function addSecondary(t, opt) {
      var sec = payload.secondary;
      var primY = Array.isArray(opt.yAxis) ? opt.yAxis : [opt.yAxis];
      var secX, secY, secSeries, secYIdx = primY.length;
      // Decide the secondary first so a malformed payload leaves the primary's
      // single-grid layout untouched rather than half-rewritten.
      if (sec.kind === "sleep" && sec.sleep && sec.sleep.epochs && sec.sleep.epochs.length) {
        var ep = sec.sleep.epochs, times = ep.map(function (e) { return new Date(e.x).getTime(); });
        var lastT = times[times.length - 1], step = ep.length > 1 ? (times[1] - times[0]) : 20 * 60000;
        secX = Object.assign(axisCommon(t), { gridIndex: 1, type: "time", min: times[0], max: lastT + step,
          splitLine: { show: false }, axisLabel: { color: alpha(t.text, 0.6), fontSize: 10, formatter: { day: "{HH}:{mm}", hour: "{HH}:{mm}" } } });
        secY = sleepYAxis(t, secYIdx);
        secSeries = [hypnogramSeries(t, ep, times, lastT, step, secYIdx)];
      } else if (sec.series) {
        var s = sec.series, samples = s.isSamples;
        var sdata = samples ? (s.points || []).map(function (p) { return [p.x, p.y]; }) : (s.values || []);
        secX = Object.assign(axisCommon(t), { gridIndex: 1, type: samples ? "time" : "category",
          data: samples ? undefined : payload.categories, boundaryGap: !samples, splitLine: { show: false },
          axisLabel: { color: alpha(t.text, 0.6), fontSize: 10, hideOverlap: true,
            formatter: samples ? timeAxisFormatter() : undefined } });
        secY = Object.assign(axisCommon(t), { gridIndex: 1, type: "value", scale: true, position: "right",
          axisLine: { show: false }, splitLine: { show: false }, axisLabel: { show: false } });
        // Fine-grained dark rounded bars (the design's distribution look).
        secSeries = [{ type: "bar", xAxisIndex: 1, yAxisIndex: secYIdx, data: sdata, barMaxWidth: 4, barMinWidth: 1,
          itemStyle: { borderRadius: [2, 2, 0, 0], color: alpha(t.text, 0.78) } }];
      } else {
        return;
      }
      opt.grid = [
        { left: 8, right: 16, top: 14, height: "50%", containLabel: true },
        { left: 8, right: 16, top: "72%", height: "21%", containLabel: true }
      ];
      var primX = Array.isArray(opt.xAxis) ? opt.xAxis[0] : opt.xAxis;
      primX.gridIndex = 0;
      primX.axisLabel = { show: false }; // the secondary carries the shared x labels
      primY.forEach(function (a) { a.gridIndex = 0; });
      opt.xAxis = [primX, secX];
      opt.yAxis = primY.concat([secY]);
      opt.series = (opt.series || []).concat(secSeries);
      opt.dataZoom = [{ type: "inside", xAxisIndex: [0, 1], throttle: 50 }];
      opt.axisPointer = { link: [{ xAxisIndex: "all" }] };
      opt.toolbox = { show: false };
      var titles = (opt.title && opt.title.length) ? opt.title : [];
      titles.push({ text: sec.title || (sec.kind === "sleep" ? "Sleep stages" : (sec.series ? sec.series.name : "")),
        left: "center", top: "65%", textStyle: { fontSize: 11, fontWeight: "normal", color: alpha(t.text, 0.55) } });
      opt.title = titles;
    }

    // White glyphs centred in an event badge, as data-URI SVGs for crispness:
    // a flame for workouts, "z" for sleep.
    function evtGlyph(kind) {
      var svg = kind === "sleep"
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="12" y="18" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">z</text></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.96 2.29a.75.75 0 00-1.07-.14 9.74 9.74 0 00-3.54 6.18 7.55 7.55 0 01-1.7-1.72.75.75 0 00-1.16-.08A9 9 0 1015.68 4.53a7.46 7.46 0 01-2.72-2.24zM15.75 14.25a3.75 3.75 0 11-7.32-1.17c.63.46 1.35.8 2.14 1a5.99 5.99 0 011.92-3.55 3.75 3.75 0 013.26 3.72z"/></svg>';
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    // addEvents annotates workout/sleep events as circular badges on a baseline
    // strip at the bottom of the primary grid (the design's event markers).
    // Hovering a badge shows a callout with the metric range during the event
    // and a connector up to that point on the line.
    function addEvents(t, opt) {
      var evs = payload.events;
      var primX = Array.isArray(opt.xAxis) ? opt.xAxis[0] : opt.xAxis;
      if (!primX || primX.type !== "time") return; // events are timestamped
      opt.series = (opt.series || []).concat([{
        type: "custom", data: evs, xAxisIndex: 0, yAxisIndex: 0, z: 7,
        tooltip: {
          trigger: "item", confine: true,
          backgroundColor: alpha(t.bg, 0.97), borderColor: alpha(t.tick, 0.4), borderWidth: 1,
          padding: [7, 10], textStyle: { color: t.text, fontSize: 12 },
          formatter: function (p) {
            var e = evs[p.dataIndex];
            return (e.value ? "<div style='font-weight:600;font-size:13px'>" + e.value + "</div>" : "") +
              "<div style='opacity:.55;font-size:11px;margin-top:1px'>" + e.label + "</div>";
          }
        },
        renderItem: function (params, api) {
          var ev = evs[params.dataIndex];
          var cs = params.coordSys;
          var px = api.coord([new Date(ev.x).getTime(), 0])[0];
          var py = cs.y + cs.height - 11; // badge centre on the bottom strip
          var dark = alpha(t.text, 0.86), r = 9;
          var kids = [];
          // Clean floating badges — no baseline strip or tie-line (they read as
          // stray gridlines); the metric during the event appears on hover.
          kids.push({ type: "circle", shape: { cx: px, cy: py, r: r }, style: { fill: dark } });
          kids.push({ type: "image", style: { image: evtGlyph(ev.kind), x: px - 6, y: py - 6, width: 12, height: 12 } });
          return { type: "group", children: kids };
        }
      }]);
    }

    function buildOption() {
      var t = cssVars();
      var opt = payload.kind === "agp" ? agpOption(t)
        : payload.kind === "macro" ? macroOption(t)
        : payload.kind === "sleep" ? sleepOption(t)
        : metricOption(t);
      return opt;
    }

    // header and the option builder; extracted with the region above.
    // Header stats read as whole numbers (most health metrics are integers);
    // sub-10 values keep one decimal.
    function statFmt(v) {
      if (v == null) return "–";
      var n = Number(v);
      return Math.abs(n) >= 10 ? Math.round(n).toLocaleString() : (Math.round(n * 10) / 10).toString();
    }
    // formatDuration renders a duration value already rescaled to its axis unit
    // (h/m/s by chooseDurationAxis) as a compact label: "7h 12m" for hours,
    // "45m" for minutes, "53s" for seconds.
    function formatDuration(v, unit) {
      if (v == null) return "–";
      v = Number(v);
      if (unit === "h") { var t = Math.round(v * 60); return Math.floor(t / 60) + "h " + (t % 60) + "m"; }
      if (unit === "m") return Math.round(v) + "m";
      return Math.round(v) + "s";
    }

    return buildOption();
  }
}
