import { test } from "node:test";
import assert from "node:assert/strict";

import { PROFESSIONS, professionBySlug, exampleFor } from "./professions";
import { livePrograms, packFor } from "./index";

test("PROFESSIONS: unique slugs, well-formed content", () => {
  const slugs = PROFESSIONS.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slugs are unique");
  for (const p of PROFESSIONS) {
    assert.ok(/^[a-z0-9-]+$/.test(p.slug), `slug ${p.slug} is URL-safe`);
    assert.ok(p.label.length > 0 && p.intro.length > 0 && p.singular.length > 0);
  }
});

test("professionBySlug: resolves known slugs, undefined otherwise", () => {
  assert.ok(professionBySlug("software-engineer"));
  assert.equal(professionBySlug("nope"), undefined);
});

test("exampleFor: returns a tuned example or null (never throws)", () => {
  const eng = professionBySlug("software-engineer")!;
  assert.ok(typeof exampleFor(eng, "Awards") === "string");
  assert.equal(exampleFor(eng, "Nonexistent criterion"), null);
});

test("every live (classification × profession) page has renderable criteria copy", () => {
  // Each pack criterion resolves to either a tuned example or the pack's generic
  // evidence — so no SEO page ever renders an empty criterion.
  for (const c of livePrograms()) {
    for (const p of PROFESSIONS) {
      for (const crit of packFor(c).criteria) {
        const copy = exampleFor(p, crit.name) ?? crit.evidence;
        assert.ok(copy.length > 0, `${c}/${p.slug}/${crit.name} has copy`);
      }
    }
  }
});
