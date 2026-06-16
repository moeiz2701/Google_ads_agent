/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @gaa/shared is consumed as TS source from the workspace.
  transpilePackages: ["@gaa/shared"],
  // resvg ships a native .node addon; keep it external so Next requires it from
  // node_modules at runtime instead of (mis)bundling the binary.
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
