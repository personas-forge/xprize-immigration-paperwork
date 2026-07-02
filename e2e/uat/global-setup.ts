import { rm } from "node:fs/promises";
import { UAT_PGLITE_DIR } from "../../playwright.uat.config";

/** Fresh seed per run: wipe the PGlite data dir before the server boots (the
 *  webServer starts after globalSetup), so every UAT run begins with a
 *  never-onboarded dev user holding 0 tokens. */
export default async function globalSetup(): Promise<void> {
  await rm(UAT_PGLITE_DIR, { recursive: true, force: true });
}
