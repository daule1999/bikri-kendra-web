import type { NextConfig } from "next";

// Static export → plain HTML/CSS/JS in ./out, served by Cloudflare as static assets.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
