# Decisions log

## CP0 — boot (2026-07-02)
- Ship bar: **Public launch with real payments** (strictest gates)
- Cadence: **Marathon** — check in only when blocked or every 4th milestone
- First focus: **UAT harness first** (items 12–14)
- UAT depth: **All journeys + edge cases** (hostile/edge persona is ship-blocking)

## Auto-decided (pending user review at next CP)
- 2026-07-02 — Created branch `ship-loop/readiness-2026-07-02` off main instead of asking: workspace memory records that main is release-automation-managed and local unpushed commits on main get reset away, so working on main risks losing the loop's work. Reversible (merge/rebase/PR later; user decides when/whether to push).
