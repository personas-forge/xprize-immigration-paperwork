# Jurisdictions & market scope

This product is only valid in the markets it is explicitly scoped for. Two
*independent* axes decide that:

1. **Immigration regime** — the destination country whose visa is filed.
2. **Legal-practice compliance** — who may lawfully prepare/sign, and the
   business structure behind it.

> Informational product scope, **not legal advice**. The UPL / representation /
> business-structure specifics for each market must be confirmed by qualified
> counsel in that market.

## Current scope (locked)

| Jurisdiction | Status | Programs | Who may represent | Structure |
|---|---|---|---|---|
| 🇺🇸 United States | **live** | O-1A, O-1B, EB-1A | Attorney of record | Federal — see below |
| 🇬🇧 United Kingdom | planned | Global Talent (provisional) | Solicitor (SRA) or OISC adviser | TBD |

### United States — federal, nationwide
U.S. immigration is **federal** (INA / 8 USC 1101), so it is uniform across all
50 states — there is no per-state O-1A. Immigration practice is federally
preempted: an attorney licensed and in **good standing in any one U.S. state**
may act as attorney of record **nationwide** (8 CFR §1.2; USCIS Form G-28). So
**one attorney of record covers the whole country.**

The state-sensitive piece is the **business structure** (tech company + law
firm). We use the **Arizona ABS** (Alternative Business Structure) model —
Arizona abolished Model Rule 5.4, permitting an attorney-owned firm that the
platform licenses software to.

### United Kingdom — planned
Global Talent is criteria-based and fits the same engine, but UK advice must
come from an SRA-regulated solicitor or an OISC-regulated adviser, and the
endorsement criteria depend on the endorsing body. The program is defined
(`packs.ts`, `UK-Global-Talent`) but marked **planned** with provisional
criteria; it is not offered until UK counsel confirms criteria + representation.

## How it's modelled in code

- `src/features/qualification/packs.ts` — visa **programs** (criteria packs),
  including the planned UK program.
- `src/features/qualification/jurisdictions.ts` — the **jurisdiction registry**:
  each jurisdiction owns programs and carries `status`, `representationRole`,
  `representationNote`, and a market-specific `disclaimer`.
- A case's jurisdiction is **derived** from its program (`jurisdictionFor`) — no
  new column is persisted.
- Only **live** programs are offered: the `/qualify` selector uses
  `livePrograms()`, and the API rejects non-live program codes (`isLiveProgram`).

## Adding a market

1. Add the program pack(s) to `packs.ts` (and to the `Classification` union).
2. Add/flip the jurisdiction in `jurisdictions.ts` (programs, representation,
   disclaimer); set `status: "live"` only after counsel sign-off.
3. Wire the market disclaimer into the result builders (today they use the
   single US `DISCLAIMER`; per-jurisdiction disclaimers are defined and ready).
4. Extend the representation gate (`ATTORNEY_EMAILS` / roles) to that market's
   regulated representatives.
