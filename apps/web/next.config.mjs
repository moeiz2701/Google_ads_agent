/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @gaa/shared is consumed as TS source from the workspace.
  transpilePackages: ["@gaa/shared"],
  // resvg ships a native .node addon; keep it external so Next requires it from
  // node_modules at runtime instead of (mis)bundling the binary.
  // country-state-city ships a ~17MB static dataset; keep it external so Next
  // doesn't bundle/transform it (it's only ever used server-side in /api/geo).
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js", "country-state-city"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
