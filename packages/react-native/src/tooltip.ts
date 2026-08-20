/**
 * Flatten the builder's tooltip markup to text.
 *
 * The option builder is shared with the web renderer, where a tooltip is a DOM
 * node and its formatter returns HTML. Skia and SVG have no DOM: ECharts draws
 * whatever string it gets, so the markup renders verbatim — a tooltip reading
 * `;font-size:11px'>Aug 8</div>`. Rewriting the formatters upstream would mean
 * the web renderer losing its styling, so the flattening happens here, on the
 * built option, and only on this platform.
 */

/** Entities the builder's formatters can emit. Not a general HTML decoder. */
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * Text of an HTML fragment, with block boundaries kept as newlines so a
 * multi-line tooltip stays multi-line.
 */
export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|p|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;|&#\d+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .trim();
}

/** Marks a formatter this module already wrapped, so a re-walk can't double-wrap. */
const WRAPPED = Symbol.for("terra.plainTooltip");

type Formatter = ((...args: unknown[]) => unknown) & { [WRAPPED]?: true };

/**
 * Wrap every `tooltip.formatter` in the option so its result is plain text.
 *
 * Tooltips are configured at the root and per series, and the sleep and macro
 * charts add their own, so this walks rather than naming the known sites — a
 * new decoration in the shared builder shouldn't reintroduce raw markup here.
 * Mutates in place: the option was just built for this render and is not shared.
 */
export function plainTextTooltips<T>(option: T): T {
  const seen = new Set<unknown>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const record = node as Record<string, unknown>;
    const tip = record.tooltip as { formatter?: Formatter } | undefined;
    const inner = tip?.formatter;
    if (typeof inner === "function" && !inner[WRAPPED]) {
      const wrapped: Formatter = (...args: unknown[]) => {
        const out = inner(...args);
        return typeof out === "string" ? toPlainText(out) : out;
      };
      wrapped[WRAPPED] = true;
      tip!.formatter = wrapped;
    }

    Object.values(record).forEach(visit);
  };

  visit(option);
  return option;
}
