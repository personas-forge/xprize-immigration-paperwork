// L2 grounded qualify driver — hits the live /api/qualify (real Claude via CLI) for the
// non-default profiles whose case rides entirely on the live model read (L1 confirmed the
// keyless mock under-reads them). Saves each result JSON + prints a compact assertion:
// right criteria PACK for the visa, evidence mapped to the right criterion, named specifics
// present, disclaimer rides the payload, source=claude. Spaced + 429-retry for the per-user
// qualify rate limit.
import { writeFile } from "node:fs/promises";

const BASE = process.env.BASE_URL || "http://localhost:3010";
const OUT = "uat/runs/2026-06-20-l2";

const CASES = [
  { slug: "lucia-ferraro-filmmaker", name: "Lucia Ferraro", classification: "O-1B",
    expectPack: ["Lead role in distinguished productions","National or international recognition","Reviews & press","Record of major commercial or critical success","Recognition from organizations & experts","High salary or remuneration"],
    specifics: ["Sundance","Variety","Guild","distribution"],
    profile: "Italian-born documentary film director, 10+ years directing. My last feature was an official selection at the Sundance Film Festival and screened at IDFA and Hot Docs. It received a New York Times Critic's Pick and a positive Variety review. I signed a theatrical and streaming distribution deal for it. I am a voting member of the Directors Guild of America and the International Documentary Association. I have directed (lead creative role) all four of my feature documentaries." },
  { slug: "noa-grossman-composer", name: "Noa Grossman", classification: "O-1B",
    expectPack: ["Lead role in distinguished productions","National or international recognition","Reviews & press","Record of major commercial or critical success","Recognition from organizations & experts","High salary or remuneration"],
    specifics: ["Emmy","stream","Guild","Variety"],
    profile: "Film, television and video-game composer. I composed the original scores for two award-winning feature films and a AAA video game; one score won a Game Audio Network Guild award and another received an Emmy nomination for Outstanding Music Composition. My scores have over 40 million streams across platforms. I am a member of the Society of Composers & Lyricists. My work has been featured in Variety and Film Music Magazine. I am the principal/lead creative author of every score I write." },
  { slug: "marcus-bell-athlete-coach", name: "Marcus Bell", classification: "O-1A",
    expectPack: ["Awards","Membership","Press","Judging","Original contribution","Scholarly articles","Critical role","High remuneration"],
    specifics: ["World Cup","champion","coach","sponsor"],
    profile: "Professional sport climber and national-team coach. Three IFSC World Cup podium finishes (2 silver, 1 bronze); US national champion 2022. Head coach of the US national youth climbing team. Multi-year sponsorship deals with two major outdoor brands. No academic publications." },
  { slug: "ingrid-larsson-architect", name: "Ingrid Larsson", classification: "EB-1A",
    expectPack: ["Awards","Membership","Press","Judging","Original contribution","Scholarly articles","Artistic exhibitions","Leading or critical role","High remuneration","Commercial success in the arts"],
    specifics: ["Biennale","exhibit","monograph","competition"],
    profile: "Principal architect, 15+ years. I won first prize in two international architecture competitions. My work was exhibited at the Venice Architecture Biennale and in a solo gallery show. I authored a published monograph on my design practice and peer-reviewed for an architecture journal. I led (critical role) the design of three landmark civic buildings. My projects have been covered in Dezeen and Architectural Record." },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callQualify(c) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${BASE}/api/qualify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: c.name, classification: c.classification, profile: c.profile }),
    });
    if (res.status === 429) { console.log(`  [${c.slug}] 429 rate-limited, backing off ${attempt*15}s…`); await sleep(attempt * 15000); continue; }
    const text = await res.text();
    return { status: res.status, text };
  }
  return { status: 429, text: "{}" };
}

for (const c of CASES) {
  console.log(`\n=== ${c.slug} (${c.classification}) ===`);
  const { status, text } = await callQualify(c);
  let r; try { r = JSON.parse(text); } catch { console.log(`  NON-JSON (HTTP ${status}):`, text.slice(0, 200)); continue; }
  await writeFile(`${OUT}/${c.slug}-qualify.json`, JSON.stringify(r, null, 2));
  const names = (r.criteria || []).map((x) => x.name);
  const packOk = JSON.stringify(names) === JSON.stringify(c.expectPack);
  const met = (r.criteria || []).filter((x) => /met|strong/i.test(x.status || "")).map((x) => `${x.name}:${x.status}`);
  const blob = JSON.stringify(r).toLowerCase();
  const namedHits = c.specifics.filter((s) => blob.includes(s.toLowerCase()));
  console.log(`  source=${r.source}  likelihood=${r.likelihood}  HTTP=${status}`);
  console.log(`  PACK CORRECT (${c.classification} ${c.expectPack.length}-criteria): ${packOk ? "YES" : "NO"}`);
  if (!packOk) console.log(`    got: ${names.join(" | ")}`);
  console.log(`  Met/Strong: ${met.join(" | ") || "(none)"}`);
  console.log(`  named specifics echoed: ${namedHits.join(", ")} (${namedHits.length}/${c.specifics.length})`);
  console.log(`  disclaimer rides payload: ${!!r.disclaimer}`);
  await sleep(12000); // space out for the per-user qualify rate limit
}
console.log("\nDONE — artifacts in", OUT);
