"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Guilloche } from "@/components/brand/Guilloche";
import { stampIn, easeArrival } from "@/lib/motion";
import { cn } from "@/lib/cn";

// — Petition-progress stepper ───────────────────────────────────────────────
// A horizontal procession of five rosettes that double as stamp-slots. The
// current stage is "pressed" with a gold-leaf rubber stamp that scales,
// rotates, and fades in; below the rail a status pill narrates the stage.
// Client-only; pure framer-motion + Tailwind; respects reduced-motion.

type Stage = {
  name: string;
  status: string;
  eta: string;
};

const STAGES: Stage[] = [
  { name: "Intake",          status: "Voice interview booked — discovery in 24 hours.",          eta: "Est. same week" },
  { name: "Drafting",        status: "Gemini assembling petition letter & exhibits.",             eta: "Est. 3 days" },
  { name: "Attorney Review", status: "Stage 3: Attorney reviewing every paragraph.",              eta: "Est. 2 weeks" },
  { name: "Filed",           status: "I-129 e-filed with USCIS (premium processing).",            eta: "Receipt issued" },
  { name: "Approved",        status: "Approval notice received. Status updated on the file.",     eta: "Decision in hand" },
];

export function PetitionStepper() {
  const [stage, setStage] = useState(2); // start mid-flight, attorney review
  const reduce = useReducedMotion();
  const current = STAGES[stage];
  const next = () => setStage((s) => (s + 1) % STAGES.length);

  return (
    <section className="relative border-y border-border bg-surface/40 guilloche">
      <div className="mx-auto max-w-6xl px-8 py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="microprint" style={{ color: "var(--accent-dark)" }}>
              § Live · Petition File O1-241
            </div>
            <h2 className="display mt-4 text-[clamp(2rem,5vw,3.4rem)]">
              Every stage <em>sealed</em>, on the record.
            </h2>
            <p className="mt-3 max-w-xl font-sans text-[15.5px] leading-relaxed text-muted-strong">
              Five passes from intake to approval — each one stamped, dated, and
              visible to you and your attorney from the moment it&apos;s pressed.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={next}
              aria-label="Advance to the next petition stage"
              className="inline-flex items-center gap-2 rounded-control bg-foreground px-5 py-2.5 font-mono text-[11.5px] uppercase tracking-document text-background transition-[background-color,transform] hover:bg-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
              Next stage
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>

        {/* Rail */}
        <div className="relative mt-14">
          {/* perforated rail behind the rosettes */}
          <div
            aria-hidden
            className="perforation absolute left-[4%] right-[4%] top-[44px] h-px"
          />

          <ol className="relative grid grid-cols-5 gap-2">
            {STAGES.map((s, i) => {
              const isActive = i === stage;
              const isPast = i < stage;
              return (
                <li key={s.name} className="flex flex-col items-center text-center">
                  <button
                    type="button"
                    onClick={() => setStage(i)}
                    aria-label={`Jump to stage ${i + 1}: ${s.name}`}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "group relative grid h-[88px] w-[88px] place-items-center rounded-pill border-2 transition-[border-color,background-color,color] duration-300",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40",
                      isActive
                        ? "border-[color:var(--accent)] bg-surface text-accent-dark"
                        : isPast
                          ? "border-[color:var(--accent-dark)]/60 bg-surface-muted text-accent-dark"
                          : "border-border-strong bg-surface text-muted-strong hover:border-foreground",
                    )}
                  >
                    {/* guilloché rosette inside each circle */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 grid place-items-center opacity-40"
                    >
                      <Guilloche size={84} rings={5} />
                    </span>

                    {/* center stamp slot */}
                    <span className="relative z-10 grid h-10 w-10 place-items-center">
                      <AnimatePresence mode="popLayout">
                        {isActive ? (
                          <motion.span
                            key="stamp"
                            variants={stampIn}
                            initial={reduce ? false : "hidden"}
                            animate="show"
                            exit={reduce ? undefined : { opacity: 0, scale: 0.85, rotate: 6, transition: { duration: 0.2 } }}
                            className="grid h-10 w-10 place-items-center rounded-pill border-2 border-double border-[color:var(--accent)] bg-[color:var(--accent-soft)] font-mono text-[10px] uppercase tracking-tight text-accent-dark shadow-leaf"
                          >
                            {String(i + 1).padStart(2, "0")}
                          </motion.span>
                        ) : isPast ? (
                          <motion.span
                            key="past"
                            initial={false}
                            animate={{ opacity: 1 }}
                            className="grid h-10 w-10 place-items-center rounded-pill border border-[color:var(--accent-dark)]/50 bg-transparent font-mono text-[10px] uppercase tracking-tight text-accent-dark"
                          >
                            ✓
                          </motion.span>
                        ) : (
                          <span className="font-mono text-[11px] uppercase tracking-document text-muted">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        )}
                      </AnimatePresence>
                    </span>
                  </button>

                  <div className="mt-4 microprint">{`Stage ${String(i + 1).padStart(2, "0")}`}</div>
                  <div
                    className={cn(
                      "display mt-1 text-[15px]",
                      isActive ? "text-foreground" : "text-muted-strong",
                    )}
                  >
                    {s.name}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Status pill */}
        <div className="mt-12 flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: easeArrival }}
              className="inline-flex items-center gap-3 rounded-pill border border-border-strong bg-surface px-5 py-2.5 shadow-leaf"
            >
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--accent)]" aria-hidden />
              <span className="microprint" style={{ color: "var(--muted)" }}>
                {`Stage ${String(stage + 1).padStart(2, "0")}`}
              </span>
              <span className="font-sans text-[14px] italic text-foreground">
                {current.status}
              </span>
              <span className="hidden sm:inline-block h-3 w-px bg-border-strong" aria-hidden />
              <span className="microprint hidden sm:inline" style={{ color: "var(--accent-dark)" }}>
                {current.eta}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
