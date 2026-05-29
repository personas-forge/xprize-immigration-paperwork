// Ambient declaration for the `server-only` guard module.
//
// Next.js bundles `server-only` internally (node_modules/next/dist/compiled/
// server-only) and aliases it during the build, so the import works at runtime
// and throws if a server module is ever pulled into a Client Component bundle.
// `tsc --noEmit` doesn't know about that alias, so we declare the module here
// to keep the type-check green without adding a runtime dependency.
declare module "server-only" {}
