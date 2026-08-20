/**
 * The package is standalone on purpose — it shares concepts with `@tryterra/graphs`
 * but no code, because importing that package registers a custom element and
 * pulls in `HTMLElement`. These few declarations are the price of that
 * independence.
 */

/**
 * A calendar date, `YYYY-MM-DD`, in UTC.
 *
 * Deliberately not a `Date`. A graph window is a run of calendar days, while a
 * `Date` is an instant — converting between them means choosing a timezone, and
 * no choice is right for everyone. The obvious conversion is also wrong: a date
 * picker hands you `new Date(2026, 7, 1)` for "1 August", and
 * `.toISOString().slice(0, 10)` turns that into `2026-07-31` anywhere east of
 * Greenwich. Typing the string means a `Date` fails to compile instead of
 * shifting a day in production. Use `toIsoDate()` if you have a `Date`.
 */
export type IsoDate = `${number}-${number}-${number}`;

/** Colour overrides, applied over the graph's dashboard configuration. */
export interface GraphTheme {
  bg?: string;
  line?: string;
  text?: string;
  tick?: string;
  chartType?: "line" | "bar";
}

/** One plotted metric. The renderer owns this shape; only what the header and
 *  the tooltip read is declared. */
export interface GraphSeries {
  name: string;
  unit?: string;
  format?: string;
  isSamples?: boolean;
  values?: (number | null)[];
  points?: { x: string; y: number | null }[];
}

/** The chart payload from `GET /graphs/{session}/{user}?format=json`. */
export interface GraphPayload {
  kind: "metric" | "agp" | "macro" | "sleep";
  title: string;
  subtitle?: string;
  theme?: GraphTheme;
  series?: GraphSeries[];
  categories?: string[];
  xMode?: "category" | "time";
  axisMode?: string;
  singleDay?: boolean;
  icon?: string;
  headerStats?: string[];
  stats?: Record<string, number | string | null>;
  status?: { text: string; tone?: "good" | "warn" | "bad" | "neutral" };
  sleep?: {
    stages: { key: string; label: string; color: string; seconds: number; percent: number }[];
    durationLabel: string;
    awakeLabel: string;
  };
  [key: string]: unknown;
}

/** A failed render, carrying the trace id Terra support needs to look it up. */
export class TerraGraphError extends Error {
  readonly status: number;
  readonly traceId?: string;

  constructor(message: string, status: number, traceId?: string) {
    super(message);
    this.name = "TerraGraphError";
    this.status = status;
    this.traceId = traceId;
  }
}

/**
 * The calendar day a `Date` falls on in the local timezone — what a date picker
 * means when the user clicks a day. Use this rather than `toISOString()`.
 */
export function toIsoDate(date: Date): IsoDate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as IsoDate;
}
