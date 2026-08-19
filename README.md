# terra-graphs

Embed Terra health graphs in your app, in your own DOM rather than an iframe.

| Package | Install | For |
| --- | --- | --- |
| [`terra-graphs`](packages/core) | `npm i terra-graphs` | Any framework, via the `<terra-graph>` custom element |
| [`terra-graphs-react`](packages/react) | `npm i terra-graphs-react` | React, with typed props and callbacks |

Graphs are designed in the [Terra dashboard](https://dashboard.tryterra.co/dashboard/graphs) — metric, chart type, colours, header stats — and referenced here by id. Full guide: [docs.tryterra.co/graphs](https://docs.tryterra.co/graphs).

## How it works

The chart engine is not bundled. Both packages load Terra's renderer from the Graph API at mount time, then draw the payload for one user into a shadow root on your page.

That is deliberate. The same renderer draws the graph in Terra's dashboard, in the hosted embed page, and in your app — so what you see while designing a graph is what your users get, and a rendering fix reaches every embed without anyone publishing or upgrading a package. It is the shape Stripe.js and the Google Maps loader use, for the same reason.

The cost is that graphs need network access to `api.tryterra.co` at render time, which they already needed for the data, and a CSP entry if you run one. Both READMEs cover it.

## Development

```bash
npm install
npm run build      # both packages, ESM + CJS + types
npm run typecheck
npm test           # unit tests, including the server-render guarantee
npm run test:e2e   # mounts both packages in headless Chromium
```

`npm run test:e2e` renders real payloads through the real renderer. It reads the renderer from the deployed API by default; to test against an unreleased one, point it at a local copy:

```bash
TERRA_GRAPH_BUNDLE=../terra-v6/services/api/dist/static/graphs/terra-graph.js npm run test:e2e
```

The renderer itself lives in `terra-v6` at `services/api/dist/static/graphs/terra-graph.js`. Chart changes belong there, not here.

## Releasing

`.github/workflows/release_package.yml`, run manually from the Actions tab. Pick a package and a release type; it builds, bumps, tags, and publishes to npm.
