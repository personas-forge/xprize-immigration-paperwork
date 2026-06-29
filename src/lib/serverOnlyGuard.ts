// Shared server-only runtime guard. The `server-only` npm package is unresolvable
// under the `tsx --test` runner, so the test-reachable server modules (auth
// session/db/route-authz, the firebase-admin handles, and the Store drivers)
// enforce the same "never bundled to the client" contract with this runtime check
// instead of `import "server-only"`. Call `assertServerOnly("@/lib/…")` at the top
// of each such module; it throws at import time if the module reaches the client.
//
// Zero-dependency on purpose: importing it pulls no server-only code, so it is safe
// for every module in the boundary (and for the unit-test runner).
export function assertServerOnly(moduleName: string): void {
  if (typeof window !== "undefined") {
    throw new Error(`${moduleName} must not be imported on the client.`);
  }
}
