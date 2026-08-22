import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingRoot: process.cwd(),
  images: {
    qualities: [75, 90],
  },
};

export default nextConfig;
