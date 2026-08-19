export {
  DEFAULT_BASE_URL,
  TerraGraphError,
  fetchPayload,
  graphUrl,
  loadRenderer,
  toIsoDate,
  type GraphHandle,
  type GraphPayload,
  type GraphRange,
  type GraphSource,
  type GraphTheme,
  type IsoDate,
} from "./loader";
export { defineTerraGraph, type TerraGraphElement } from "./element";

import { defineTerraGraph } from "./element";

// Importing the package is how you get the element — there is nothing else to
// call, and a registration step everyone has to remember is a step everyone
// eventually forgets. No-op outside a browser, so SSR imports are fine.
defineTerraGraph();
