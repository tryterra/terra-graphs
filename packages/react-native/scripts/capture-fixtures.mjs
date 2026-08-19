/**
 * Captures real chart payloads from Terra's public preview endpoint into
 * test/fixtures, so the option-builder tests run without a network.
 *
 * Re-run when the payload shape changes; commit the result.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");
const API = process.env.TERRA_GRAPHS_UPSTREAM ?? "https://api.tryterra.co/v2";

// One per branch of the builder a native renderer has to survive.
const CASES = {
  "metric-bar": {
    graph_type: "daily.distance_data.steps",
    chart_type: "bar",
    header_stats: ["average"],
    show_labels: true,
    icon: "auto",
  },
  "metric-baseline": {
    graph_type: "daily.heart_rate_data.summary.resting_hr_bpm",
    show_baseline: true,
    baseline_label: "Baseline",
    show_markers: true,
    marker_extreme: "both",
    header_stats: ["latest", "average"],
    icon: "auto",
  },
  "metric-zones": {
    graph_type: "activity.heart_rate_data.detailed.hr_samples.bpm",
    zones: "hr",
    scope: "session",
    header_stats: ["range"],
  },
  "metric-combo": {
    graph_type: "daily.distance_data.steps+daily.heart_rate_data.summary.resting_hr_bpm",
    metric_chart_types: {
      "daily.distance_data.steps": "bar",
      "daily.heart_rate_data.summary.resting_hr_bpm": "line",
    },
  },
  "metric-panels": {
    graph_type: "daily.distance_data.steps+daily.heart_rate_data.summary.resting_hr_bpm",
    panel_mode: "panels",
  },
  "metric-range": {
    graph_type: "daily.heart_rate_data.detailed.hr_samples.bpm",
    show_range: true,
    header_stats: ["range"],
  },
  "metric-status": {
    graph_type: "daily.distance_data.steps",
    status: "On track",
    status_tone: "good",
    bg_color: "#0F172A",
    line_color: "#38BDF8",
    text_color: "#E2E8F0",
    tick_color: "#475569",
  },
  "metric-duration": {
    graph_type: "sleep.sleep_durations_data.asleep.duration_asleep_state_seconds",
    header_stats: ["average", "range"],
  },
  agp: { graph_type: "BODY_GLUCOSE_AGP" },
  macro: { graph_type: "MACRO_BREAKDOWN", show_labels: true },
  sleep: { graph_type: "SLEEP_STAGES" },
};

fs.mkdirSync(OUT, { recursive: true });

for (const [name, config] of Object.entries(CASES)) {
  const url = `${API}/graphs/preview?timeframe=30&config=${encodeURIComponent(JSON.stringify(config))}`;
  const html = await (await fetch(url)).text();
  const m = html.match(/<script type="application\/json" id="graph-data">([\s\S]*?)<\/script>/);
  if (!m) {
    console.error(`SKIP ${name}: no payload — ${html.slice(0, 120).replace(/\s+/g, " ")}`);
    continue;
  }
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(JSON.parse(m[1]), null, 1) + "\n");
  console.log(`captured ${name}`);
}
