/**
 * `<terra-graph>` — a Terra graph, rendered into the page rather than an iframe.
 *
 * A custom element rather than a framework component because it is the one form
 * every framework can already consume: React, Vue, Svelte, Angular and plain
 * HTML all mount it the same way. `@tryterra/graphs-react` wraps it for typed props
 * and callbacks; nothing else needs a wrapper.
 */
import {
  DEFAULT_BASE_URL,
  fetchPayload,
  loadRenderer,
  TerraGraphError,
  type GraphHandle,
  type GraphTheme,
  type IsoDate,
} from "./loader";

const OBSERVED = ["session-id", "user-id", "timeframe", "from", "to", "base-url"];

/** `YYYY-MM-DD`. Range-checked by the API; this only rejects the wrong shape. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Just enough to fill the box while the payload is in flight — the renderer
 *  brings its own skeleton, but only once it has something to render. */
const PLACEHOLDER_STYLES = `
  :host { display: block; position: relative; min-height: 120px; }
  .pending {
    position: absolute; inset: 0; display: grid; place-items: center;
    padding: 16px; border-radius: 14px;
    font: 400 13px/1.45 ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif;
    text-align: center;
  }
  .loading { background: rgba(127, 127, 127, 0.06); animation: pulse 1.4s ease-in-out infinite; }
  .failed { color: rgba(127, 127, 127, 0.85); border: 1px dashed rgba(127, 127, 127, 0.35); }
  @keyframes pulse { 50% { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .loading { animation: none; } }
`;

/** The element's own API, on top of what every HTML element has. */
export interface TerraGraphElement extends HTMLElement {
  /**
   * Colour overrides, applied over whatever the graph is configured with in the
   * dashboard. A property rather than an attribute: graphs are meant to be
   * styled in the dashboard, and this is for host-driven cases like a dark-mode
   * toggle.
   */
  theme?: GraphTheme;
  /** Redraws at the element's current size. Only needed when the element is
   *  resized in a way the browser does not report, such as being unhidden. */
  resize(): void;
  /** Refetches and redraws. */
  refresh(): void;
  /** Tears down the chart and its listeners. */
  destroy(): void;
}

/**
 * The class is built on first definition rather than at module scope, because
 * `extends HTMLElement` evaluates the base class immediately — which throws on
 * a server. Importing this package during SSR has to be free.
 */
function buildElementClass(): CustomElementConstructor {
  return class TerraGraphHTMLElement extends HTMLElement implements TerraGraphElement {
    static get observedAttributes(): string[] {
      return OBSERVED;
    }

    #theme?: GraphTheme;
    #handle: GraphHandle | null = null;
    #abort: AbortController | null = null;
    /** Guards against an earlier, slower fetch overwriting a later one — the
     *  attributes can change faster than the network answers. */
    #generation = 0;
    #connected = false;

    get theme(): GraphTheme | undefined {
      return this.#theme;
    }

    set theme(value: GraphTheme | undefined) {
      this.#theme = value;
      if (value) this.#handle?.setTheme(value);
    }

    connectedCallback(): void {
      this.#connected = true;
      void this.#load();
    }

    disconnectedCallback(): void {
      this.#connected = false;
      this.#abort?.abort();
      this.#abort = null;
      // The mounted chart is left in place: elements are detached and
      // reattached on any DOM move or framework re-parent, and tearing the
      // chart down for those would mean a refetch and a visible flash.
      this.#generation++;
    }

    attributeChangedCallback(): void {
      if (this.#connected) void this.#load();
    }

    resize(): void {
      this.#handle?.resize();
    }

    refresh(): void {
      void this.#load();
    }

    destroy(): void {
      this.#abort?.abort();
      this.#generation++;
      this.#handle?.destroy();
      this.#handle = null;
    }

    // HTML attributes are untyped strings, so the `IsoDate` guarantee the
    // TypeScript API gets has to be re-established here at runtime. Failing
    // loudly beats forwarding `08/01/2026` and letting the API answer with
    // something the customer has to decode.
    #dateAttr(name: "from" | "to"): IsoDate | undefined {
      const raw = this.getAttribute(name);
      if (raw == null || raw === "") return undefined;
      if (!ISO_DATE.test(raw)) {
        throw new Error(`@tryterra/graphs: ${name}="${raw}" is not a YYYY-MM-DD date`);
      }
      return raw as IsoDate;
    }

    async #load(): Promise<void> {
      const sessionId = this.getAttribute("session-id");
      const userId = this.getAttribute("user-id");
      if (!sessionId || !userId) {
        this.#fail(new Error("@tryterra/graphs: session-id and user-id are required"));
        return;
      }

      const generation = ++this.#generation;
      this.#abort?.abort();
      const abort = new AbortController();
      this.#abort = abort;

      const baseUrl = this.getAttribute("base-url") || DEFAULT_BASE_URL;
      let source;
      try {
        source = {
          sessionId,
          userId,
          baseUrl,
          timeframe: this.getAttribute("timeframe") ?? undefined,
          from: this.#dateAttr("from"),
          to: this.#dateAttr("to"),
        };
      } catch (err) {
        this.#fail(err);
        return;
      }

      this.#setState("loading");
      try {
        const [renderer, payload] = await Promise.all([
          loadRenderer(baseUrl),
          fetchPayload(source, { signal: abort.signal }),
        ]);
        if (generation !== this.#generation) return;

        if (this.#handle) {
          // An already-mounted chart is updated rather than remounted, so
          // changing the date range doesn't flash the widget away.
          this.#handle.update(payload);
        } else {
          this.#clearPlaceholder();
          this.#handle = renderer.mount(this, payload, { theme: this.#theme });
          await this.#handle.ready;
          if (generation !== this.#generation) return;
        }
        if (this.#theme) this.#handle.setTheme(this.#theme);
        this.setAttribute("data-state", "ready");
        this.removeAttribute("data-trace-id");
        this.dispatchEvent(new CustomEvent("terra-graph:load", { detail: { payload } }));
      } catch (error) {
        if (abort.signal.aborted || generation !== this.#generation) return;
        this.#fail(error);
      }
    }

    #fail(error: unknown): void {
      const err = error instanceof Error ? error : new Error(String(error));
      this.#setState("error", err);
      if (err instanceof TerraGraphError && err.traceId) {
        // Surfacing the trace id in the DOM lets a customer quote it to support
        // straight from their devtools.
        this.setAttribute("data-trace-id", err.traceId);
      }
      this.dispatchEvent(new CustomEvent("terra-graph:error", { detail: { error: err } }));
    }

    #setState(state: "loading" | "error", error?: Error): void {
      this.setAttribute("data-state", state);
      // Once the renderer has mounted it owns the shadow root; overwriting it
      // would throw the chart away.
      if (this.#handle) return;

      const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      const message = state === "error" ? (error?.message ?? "Graph unavailable") : "";
      root.innerHTML =
        `<style>${PLACEHOLDER_STYLES}</style>` +
        `<div class="pending ${state === "error" ? "failed" : "loading"}" role="status">` +
        escapeHtml(message) +
        `</div>`;
    }

    #clearPlaceholder(): void {
      if (this.shadowRoot) this.shadowRoot.innerHTML = "";
    }
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

let elementClass: CustomElementConstructor | undefined;

/**
 * Registers `<terra-graph>`. Called automatically when the package is imported
 * in a browser; safe to call again, and a no-op on the server.
 */
export function defineTerraGraph(tagName = "terra-graph"): void {
  if (typeof window === "undefined" || !window.customElements) return;
  if (window.customElements.get(tagName)) return;
  elementClass ??= buildElementClass();
  window.customElements.define(tagName, elementClass);
}
