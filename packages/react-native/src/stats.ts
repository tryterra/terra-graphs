/**
 * The header's numbers, with no React Native in sight.
 *
 * Split from the component so it can be tested under plain Node — importing
 * anything that reaches `react-native` drags in Flow-typed source Node cannot
 * parse. It is also the half most worth testing: these two formatters are
 * copies of the web renderer's, and a drifted copy shows up as the app and the
 * dashboard disagreeing about the same number.
 */
import type { GraphPayload } from "./types";

/** Header stats read as whole numbers; sub-10 values keep one decimal.
 *  Mirrors `statFmt` in the renderer — held to it by test/header.test.mjs. */
export function statFmt(v: unknown): string {
  if (v == null) return "–";
  const n = Number(v);
  if (Number.isNaN(n)) return "–";
  return Math.abs(n) >= 10 ? Math.round(n).toLocaleString() : String(Math.round(n * 10) / 10);
}

/** A duration already rescaled to its axis unit, as a compact label.
 *  Mirrors `formatDuration` in the renderer. */
export function formatDuration(v: unknown, unit?: string): string {
  if (v == null) return "–";
  const n = Number(v);
  if (unit === "h") {
    const t = Math.round(n * 60);
    return `${Math.floor(t / 60)}h ${t % 60}m`;
  }
  if (unit === "m") return `${Math.round(n)}m`;
  return `${Math.round(n)}s`;
}

/** Splits a formatted value into number and unit, so the unit can be set
 *  smaller and dimmer as it is on the web. */
function splitUnits(label: string): { value: string; unit: string } {
  const m = /^(.*?)([a-zA-Z%°]+)$/.exec(label.trim());
  return m?.[1] && m[2] ? { value: m[1], unit: m[2] } : { value: label, unit: "" };
}

export interface StatColumn {
  value: string;
  unit: string;
  label: string;
}

/**
 * The stat columns for a payload, in the order the graph asked for them.
 *
 * Every number here is read from the payload's `stats` block, computed
 * server-side — so the native header and the web one cannot disagree about what
 * "average" means, only about how it is printed.
 */
export function headerStats(payload: GraphPayload): StatColumn[] {
  if (payload.kind === "sleep" && payload.sleep) {
    return [
      { ...splitUnits(payload.sleep.durationLabel), label: "duration" },
      { ...splitUnits(payload.sleep.awakeLabel), label: "Awake" },
    ];
  }
  const s = payload.stats;
  if (!payload.headerStats?.length || !s) return [];

  const unit = typeof s.unit === "string" ? s.unit : "";
  const fmt = typeof s.format === "string" ? s.format : "";
  const num = (v: unknown) =>
    fmt === "duration" ? splitUnits(formatDuration(v, unit)) : { value: statFmt(v), unit };

  const columns: StatColumn[] = [];
  for (const key of payload.headerStats) {
    if (key === "latest") columns.push({ ...num(s.latest), label: String(s.latestTime ?? "") });
    else if (key === "average") columns.push({ ...num(s.average), label: "Average" });
    else if (key === "lowest") columns.push({ ...num(s.lowest), label: "Lowest" });
    else if (key === "highest") columns.push({ ...num(s.highest), label: "Highest" });
    else if (key === "range") {
      const lo = fmt === "duration" ? formatDuration(s.lowest, unit) : statFmt(s.lowest);
      const hi = fmt === "duration" ? formatDuration(s.highest, unit) : statFmt(s.highest);
      columns.push({ value: `${lo}–${hi}`, unit: fmt === "duration" ? "" : unit, label: "" });
    }
  }
  return columns;
}
