import "server-only";

import { Polar } from "@polar-sh/sdk";

/** True only when Polar credentials exist — gates all purchase paths so the
 *  app builds/runs with no billing configured. */
export function isPolarConfigured(): boolean {
  return Boolean(process.env.POLAR_ACCESS_TOKEN);
}

export function polar(): Polar {
  return new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
    // "sandbox" while testing; "production" when live.
    server: (process.env.POLAR_SERVER as "sandbox" | "production") ?? "sandbox",
  });
}

// NOTE: the @polar-sh/sdk method names/shapes (checkouts.create, webhook event
// names like "order.paid") evolve. Verify against the installed SDK version's
// types (typecheck will flag drift) and against the Polar sandbox before relying
// on the live money path.
