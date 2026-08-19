# terra-graphs

Embed Terra health graphs in your app, without an iframe.

| Package | Install | For |
| --- | --- | --- |
| [`terra-graphs`](packages/core) | `npm i terra-graphs` | Any framework, via the `<terra-graph>` custom element |
| [`terra-graphs-react`](packages/react) | `npm i terra-graphs-react` | React, with typed props and callbacks |
| [`terra-graphs-react-native`](packages/react-native) | `npm i terra-graphs-react-native` | React Native, drawn natively (no WebView) |

Graphs are designed in the [Terra dashboard](https://dashboard.tryterra.co/dashboard/graphs) — metric, chart type, colours, header stats — and referenced here by id. Full guide: [docs.tryterra.co/graphs](https://docs.tryterra.co/graphs).

## How it works

All three packages fetch the same thing — a **chart payload** from
`GET /graphs/{session}/{user}?format=json`, the identical view model Terra's own
hosted embed renders. They differ in what draws it.

**On the web**, the chart engine is not bundled: the packages load Terra's
renderer from the Graph API at mount time and draw into a shadow root. That is
deliberate. One renderer serves Terra's dashboard, the hosted embed and your
app, so what you see while designing a graph is what your users get, and a
rendering fix reaches every embed with nobody publishing or upgrading anything.
It is the shape Stripe.js and the Google Maps loader use, for the same reason.
The cost is network access to `api.tryterra.co` at render time — already needed
for the data — and a CSP entry if you run one.

**On React Native there is no DOM to load a renderer into**, so that package
bundles instead. To keep the two from drifting, its `option-builder.js` is
generated verbatim from the web renderer (three DOM reads replaced, nothing
else) and the test suite renders every chart kind through it. That keeps the
drawing identical, but it cannot restore the property above: a native app gets a
renderer fix when it upgrades and ships, not when we deploy. If that matters
more than avoiding a web view, embed the hosted URL in a `WebView` instead —
`packages/react-native/README.md` shows both.

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

The renderer itself lives in `terra-v6` at `services/api/dist/static/graphs/terra-graph.js`. Chart changes belong there, not here — including for React Native, whose `option-builder.js` is generated from it:

```bash
cd packages/react-native
node scripts/extract-option-builder.mjs                 # from the deployed renderer
node scripts/extract-option-builder.mjs ../path/to/terra-graph.js   # or a local one
npm test                                                # renders every chart kind through it
```

## Releasing

`.github/workflows/release_package.yml`, run manually from the Actions tab. Pick a package and a release type; it builds, bumps, tags, and publishes to npm.
