---
name: share-verdict
title: Share a credible "I qualify" verdict as a certificate link
promotion: discovery
surfaces: ["/c/[token]", "/qualify", "/c/[token]/opengraph-image"]
ai_surface: false
characters: [sam-reyes-founder, karen-whitfield-prospect, priya-nair-researcher]
---

## Goal (not a script)

After a positive screening I generate a shareable "Letters Patent of Extraordinary Ability"
certificate link that renders a credible verdict (and a social/OG card) I'd actually send to a
cofounder, an attorney, or post — without exposing anything private or needing a DB.

## User-POV definition of done

- A positive qualify result offers a share affordance that produces a `/c/[token]` link.
- The certificate renders from the token alone (no DB), reflecting the result, and reads as
  credible — not cheesy or overclaiming.
- The OG/share card (`/c/[token]/opengraph-image`) renders for social/preview.
- Nothing private leaks into the token/URL beyond what I chose to share.
- It carries the appropriate not-legal-advice framing (a verdict, not a legal determination).

## L1 grounding focus

`/qualify` result → the share-link mint → `/c/[token]` page + `opengraph-image`. How is the token
encoded/decoded (what data rides in it)? Is the certificate framing honest (informational, not a
legal grant)? Confirm no private/server data is required to render.
