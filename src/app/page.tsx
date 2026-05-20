export default function Page() {
  return (
    <main className="min-h-screen bg-[#f6faf9] text-stone-900">
      <header className="border-b border-teal-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-teal-700 text-xs font-bold text-white">
              ✦
            </span>
            <span className="font-semibold">Immigration Concierge</span>
          </div>
          <nav className="flex items-center gap-5 text-sm text-stone-600">
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="/docs/BACKLOG.md">Roadmap</a>
            <a
              href="#start"
              className="rounded-md bg-teal-700 px-3 py-1.5 font-semibold text-white"
            >
              Free qualification
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-8 py-20">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
          For founders · engineers · researchers · designers
        </div>
        <h1 className="mt-3 max-w-3xl font-display text-6xl leading-[0.95]">
          Your O-1 visa. AI-drafted. Attorney-signed. $2,500.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
          Same petition packet a firm would charge $8,000 to $15,000 to
          assemble — but written by Gemini from your CV, GitHub, press, and
          publications, then reviewed and signed by a licensed immigration
          attorney before it lands at USCIS.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="#start"
            className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white"
          >
            Take the 5-min qualification
          </a>
          <a
            href="/docs/BACKLOG.md"
            className="rounded-lg border border-teal-200 bg-white px-5 py-3 text-sm font-semibold text-teal-800"
          >
            Read the 12-week build plan
          </a>
          <span className="text-sm text-stone-500">
            Free if you don't qualify · 50% upfront, 50% on filing
          </span>
        </div>
      </section>

      <section className="border-y border-teal-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-8 py-12 md:grid-cols-3">
          {[
            {
              t: "70% cheaper",
              b: "$2,500 flat vs. $8K–15K typical firm. We pass the USCIS fees through at cost. No surprise add-ons.",
            },
            {
              t: "Faster — 21 days median",
              b: "Voice agent does the 45-min discovery; Gemini drafts the petition in hours; attorney reviews & signs within 5 business days.",
            },
            {
              t: "Real attorney, real bar",
              b: "Every petition is signed by a licensed U.S. immigration attorney who is on record with USCIS. We are not a DIY tool.",
            },
          ].map((b, i) => (
            <div key={i}>
              <div className="font-display text-2xl">{b.t}</div>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{b.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-8 py-16">
        <h2 className="font-display text-3xl">How it works</h2>
        <ol className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            ["01", "Qualify", "5-min self-check + voice interview. Free. We tell you yes/no/maybe with honest reasoning."],
            ["02", "Assemble", "Upload CV. We pull press, citations, GitHub. Gemini drafts the petition + 28 exhibits + I-129."],
            ["03", "Sign", "Your attorney of record reviews every word, edits where needed, signs the I-129 and the cover letter."],
            ["04", "File", "Premium processing recommended. 15 business days to decision. We pre-draft RFE responses just in case."],
          ].map(([n, t, b], i) => (
            <li key={i} className="rounded-xl border border-teal-100 bg-white p-5">
              <div className="font-mono text-xs text-teal-700">{n}</div>
              <div className="mt-1 font-display text-xl">{t}</div>
              <p className="mt-2 text-sm text-stone-600">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="pricing" className="border-t border-teal-100 bg-teal-50/40 py-16">
        <div className="mx-auto max-w-6xl px-8">
          <h2 className="font-display text-3xl">Flat. Honest. No hours billed.</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Plan title="O-1A" price="$2,500" sub="extraordinary ability · sciences, biz, athletics" lines={["Voice intake + evidence vault", "Full petition + I-129 drafted", "Attorney sign-off + e-filing", "RFE drafting included"]} highlight />
            <Plan title="O-1B" price="$3,500" sub="extraordinary achievement · arts" lines={["Stronger evidence curation", "Industry expert letter drafts", "Everything in O-1A"]} />
            <Plan title="EB-1A" price="$4,500" sub="green-card self-petition" lines={["12-month engagement", "RFE & motion handling", "Adjustment-of-status support"]} />
          </div>
          <p className="mt-6 text-sm text-stone-500">
            USCIS premium processing fee ($2,805) passthrough at cost. Free
            qualification call. Attorney on record from day 1.
          </p>
        </div>
      </section>

      <footer className="border-t border-teal-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6 text-xs text-stone-500">
          <span>© Immigration Concierge · XPrize hackathon · 90-day MVP</span>
          <span>
            <a href="/docs/BACKLOG.md" className="underline">Backlog</a> ·{" "}
            <a href="/docs/CHECKLIST.md" className="underline">Checklist</a>
          </span>
        </div>
      </footer>
    </main>
  );
}

function Plan({
  title,
  price,
  sub,
  lines,
  highlight,
}: {
  title: string;
  price: string;
  sub: string;
  lines: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight ? "border-teal-300 bg-white shadow-sm" : "border-teal-100 bg-white"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
        {title}
      </div>
      <div className="mt-1 font-display text-3xl">
        {price}
        <span className="text-base text-stone-500"> flat</span>
      </div>
      <div className="text-xs text-stone-500">{sub}</div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {lines.map((l, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-700">✓</span>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
