/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @gaa/shared is consumed as TS source from the workspace.
  transpilePackages: ["@gaa/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
