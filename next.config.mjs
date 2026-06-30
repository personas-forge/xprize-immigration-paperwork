/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 16.3 Instant Navigations: dynamic-by-default rendering + prefetched
  // static shells for instant client navigations.
  cacheComponents: true,
  partialPrefetching: true,
  // Keep the native-ish packages out of the server bundle: firebase-admin has
  // dynamic requires bundlers mishandle, and @electric-sql/pglite ships WASM.
  serverExternalPackages: ["firebase-admin", "@electric-sql/pglite"],
};
export default nextConfig;
