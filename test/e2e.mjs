/**
 * End-to-end check: mounts <terra-graph> and <TerraGraph /> in a real browser
 * and asserts each one actually paints a chart.
 *
 * The Graph API is stood in for locally, because the browser side is what is
 * under test here and a live API would make this a network-flake generator.
 * The stand-in is not a mock of the chart, though — it serves the real renderer
 * bundle and real payloads produced by Terra's own render pipeline (captured
 * from the public preview endpoint), so what gets drawn is what production
 * draws. Point TERRA_GRAPHS_UPSTREAM at a deployed API to run it for real.
 *
 *   node test/e2e.mjs
 *
 * Env:
 *   TERRA_GRAPH_BUNDLE    path to terra-graph.js (default: fetched from upstream)
 *   TERRA_GRAPHS_UPSTREAM Graph API base for payloads (default: api.tryterra.co/v2)
 */
import { chromium } from "playwright";
import * as esbuild from "esbuild";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM = process.env.TERRA_GRAPHS_UPSTREAM ?? "https://api.tryterra.co/v2";
const BUNDLE = process.env.TERRA_GRAPH_BUNDLE;

// One config per branch of the renderer worth proving end to end: the plain
// case, a decorated one, and a specialty (non-metric) payload kind.
const CASES = [
  { name: "steps", config: { graph_type: "daily.distance_data.steps", chart_type: "bar" } },
  {
    name: "resting-hr",
    config: {
      graph_type: "daily.heart_rate_data.summary.resting_hr_bpm",
      header_stats: ["latest", "average"],
      show_baseline: true,
    },
  },
  { name: "sleep-stages", config: { graph_type: "SLEEP_STAGES" } },
];

const payloadFor = async (config, timeframe) => {
  const url = `${UPSTREAM}/graphs/preview?timeframe=${timeframe}&config=${encodeURIComponent(JSON.stringify(config))}`;
  const html = await (await fetch(url)).text();
  const m = html.match(/<script type="application\/json" id="graph-data">([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no payload from ${url}`);
  return m[1];
};

const bundle = async () => {
  if (BUNDLE) return fs.readFileSync(BUNDLE, "utf8");
  const res = await fetch(`${UPSTREAM}/graphs/embed.js`);
  if (!res.ok) {
    throw new Error(
      `${UPSTREAM}/graphs/embed.js returned ${res.status}. ` +
        "Set TERRA_GRAPH_BUNDLE to a local terra-graph.js, or point " +
        "TERRA_GRAPHS_UPSTREAM at an API that serves it.",
    );
  }
  return res.text();
};

// Mirrors what the Graph API serves for these three routes.
async function startApi() {
  const [rendererJs, echartsJs] = await Promise.all([
    bundle(),
    fetch(`${UPSTREAM}/static/graphs/echarts-5.5.1.min.js`).then((r) => r.text()),
  ]);
  const payloads = new Map();
  for (const c of CASES) payloads.set(c.name, await payloadFor(c.config, 30));

  const cors = { "access-control-allow-origin": "*" };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const js = { ...cors, "content-type": "text/javascript" };

    if (url.pathname === "/v2/graphs/embed.js") return res.writeHead(200, js).end(rendererJs);
    if (url.pathname.endsWith("echarts-5.5.1.min.js")) return res.writeHead(200, js).end(echartsJs);

    const render = url.pathname.match(/^\/v2\/graphs\/([^/]+)\/([^/]+)$/);
    if (render) {
      const body = payloads.get(decodeURIComponent(render[1]));
      const json = { ...cors, "content-type": "application/json" };
      if (!body) {
        return res
          .writeHead(404, json)
          .end(JSON.stringify({ status: "failed", "error message": "No such graph", trace_id: "trace-abc" }));
      }
      if (!url.searchParams.has("format")) return res.writeHead(200, cors).end("<html>page</html>");
      return res.writeHead(200, json).end(body);
    }
    res.writeHead(404, cors).end("no");
  });
  await new Promise((r) => server.listen(0, r));
  return { server, base: `http://127.0.0.1:${server.address().port}/v2` };
}

// A drawn chart, measured on the pixels: a mounted-but-blank widget passes any
// weaker check.
const DREW = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  const canvas = el && el.shadowRoot && el.shadowRoot.querySelector("canvas");
  if (!canvas) return { drew: false, state: el && el.getAttribute("data-state") };
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4 * 37) if (data[i + 3] > 0) seen.add((data[i] << 16) | (data[i+1] << 8) | data[i+2]);
  return { drew: seen.size > 3, colours: seen.size, state: el.getAttribute("data-state") };
})()`;

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const { server, base } = await startApi();

// The packages are consumed the way a customer consumes them — imported and
// bundled — rather than hand-patched into script tags, so the published entry
// points and their React JSX are what actually runs here.
const fixture = await esbuild.build({
  stdin: {
    contents: `
      import "@tryterra/graphs";
      import * as React from "react";
      import * as ReactDOM from "react-dom/client";
      import { TerraGraph } from "@tryterra/graphs-react";
      window.__fixture = { React, ReactDOM, TerraGraph };
    `,
    resolveDir: ROOT,
    loader: "js",
  },
  bundle: true,
  format: "iife",
  write: false,
  define: { "process.env.NODE_ENV": '"development"' },
});
const fixtureJs = fixture.outputFiles[0].text;

const browser = await chromium.launch();
const newPage = async (body) => {
  const page = await browser.newPage({ viewport: { width: 820, height: 520 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setContent(
    `<!doctype html><html><head><style>
       body { margin: 0; font-family: system-ui; }
       terra-graph, .slot { display: block; width: 760px; height: 380px; }
     </style></head><body>${body}</body></html>`,
  );
  await page.addScriptTag({ content: fixtureJs });
  return { page, errors };
};

// 1. The custom element draws every payload kind.
for (const c of CASES) {
  const { page, errors } = await newPage(
    `<terra-graph id="g" session-id="${c.name}" user-id="example" timeframe="30" base-url="${base}"></terra-graph>`,
  );
  await page.waitForFunction(`document.querySelector("#g").getAttribute("data-state") !== "loading"`, {
    timeout: 15000,
  });
  await page.waitForTimeout(500);
  const probe = await page.evaluate(DREW("#g"));
  check(
    `<terra-graph> draws ${c.name}`,
    probe.drew && errors.length === 0,
    JSON.stringify({ probe, errors }),
  );
  await page.close();
}

// 2. Changing an attribute redraws without tearing the chart down.
{
  const { page, errors } = await newPage(
    `<terra-graph id="g" session-id="steps" user-id="example" timeframe="30" base-url="${base}"></terra-graph>`,
  );
  await page.waitForFunction(`document.querySelector("#g").getAttribute("data-state") === "ready"`, {
    timeout: 15000,
  });
  await page.evaluate(() => document.querySelector("#g").setAttribute("timeframe", "7"));
  await page.waitForTimeout(900);
  const probe = await page.evaluate(DREW("#g"));
  check(
    "redraws when the range changes",
    probe.drew && probe.state === "ready" && !errors.length,
    JSON.stringify({ probe, errors }),
  );
  await page.close();
}

// 3. A failure is reported as an event and left visible in the DOM, with the
//    trace id support needs.
{
  const { page } = await newPage(`<div id="slot"></div>`);
  // The element is created after the listener is attached: it starts loading
  // the moment it is connected, and the events do not bubble, so a listener
  // added afterwards can miss a fast failure.
  const detail = await page.evaluate(
    ({ base }) =>
      new Promise((resolve) => {
        const el = document.createElement("terra-graph");
        el.setAttribute("session-id", "nope");
        el.setAttribute("user-id", "example");
        el.setAttribute("base-url", base);
        el.addEventListener("terra-graph:error", (e) =>
          resolve({
            message: e.detail.error.message,
            traceId: el.getAttribute("data-trace-id"),
            state: el.getAttribute("data-state"),
          }),
        );
        document.getElementById("slot").appendChild(el);
        setTimeout(() => resolve({ message: "timed out" }), 10000);
      }),
    { base },
  );
  check(
    "reports a failure with its trace id",
    detail.message === "No such graph" && detail.traceId === "trace-abc" && detail.state === "error",
    JSON.stringify(detail),
  );
  await page.close();
}

// 4. Two graphs on one page share a single renderer load.
{
  const { page, errors } = await newPage(
    `<terra-graph id="a" session-id="steps" user-id="example" timeframe="30" base-url="${base}"></terra-graph>
     <terra-graph id="b" session-id="sleep-stages" user-id="example" timeframe="30" base-url="${base}"></terra-graph>`,
  );
  const requests = [];
  page.on("request", (r) => r.url().includes("embed.js") && requests.push(r.url()));
  await page.waitForFunction(
    `["a","b"].every(id => document.querySelector("#" + id).getAttribute("data-state") === "ready")`,
    { timeout: 20000 },
  );
  await page.waitForTimeout(400);
  const a = await page.evaluate(DREW("#a"));
  const b = await page.evaluate(DREW("#b"));
  check(
    "two graphs on a page both draw",
    a.drew && b.drew && !errors.length,
    JSON.stringify({ a, b, errors }),
  );
  await page.close();
}

// 5. The React wrapper mounts and reports back.
{
  const { page, errors } = await newPage(`<div id="root" class="slot"></div>`);
  const loaded = await page.evaluate(
    ({ base }) =>
      new Promise((resolve) => {
        const { React, ReactDOM, TerraGraph } = window.__fixture;
        ReactDOM.createRoot(document.getElementById("root")).render(
          React.createElement(TerraGraph, {
            sessionId: "steps",
            userId: "example",
            timeframe: 30,
            baseUrl: base,
            style: { display: "block", width: "760px", height: "380px" },
            onLoad: (payload) => resolve({ ok: true, title: payload.title }),
            onError: (err) => resolve({ ok: false, error: err.message }),
          }),
        );
        setTimeout(() => resolve({ ok: false, error: "timed out" }), 15000);
      }),
    { base },
  );
  await page.waitForTimeout(400);
  const probe = await page.evaluate(DREW("terra-graph"));
  check(
    "<TerraGraph /> mounts, draws and calls onLoad",
    loaded.ok && probe.drew && !errors.length,
    JSON.stringify({ loaded, probe, errors }),
  );
  await page.close();
}

await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.name}${r.ok ? "" : `\n        ${r.detail}`}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
