import assert from "node:assert/strict";
import { test } from "node:test";

import manifest from "./manifest";

// The PWA manifest is the one metadata surface NOT single-sourced from
// economy.ts / layout's siteDescription, so it drifted to a retired "$2,500 flat,
// attorney-signed" pricing claim. Guard it: the description must be valid and
// must NOT reassert the flat-fee / we-supply-the-attorney model the rest of the
// app explicitly disclaims (token-metered; YOUR attorney of record).
test("manifest description carries no retired flat-fee / attorney-signed claims", () => {
  const desc = manifest().description ?? "";
  assert.ok(desc.length > 0, "manifest has a description");
  for (const forbidden of [/\$\s?\d/, /\bflat\b/i, /attorney-signed/i, /\bretainer\b/i]) {
    assert.ok(!forbidden.test(desc), `description must not contain ${forbidden}`);
  }
  // Positive: it reflects the token model + own-attorney positioning.
  assert.match(desc, /token|free/i, "mentions the token / start-free model");
  assert.match(desc, /attorney of record/i, "names the user's own attorney of record");
});
