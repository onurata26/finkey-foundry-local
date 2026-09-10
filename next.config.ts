import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["foundry-local-sdk", "officeparser"],
  outputFileTracingExcludes: {
    "/*": ["./data/foundry/**", "./data/*.sqlite", "./data/*.sqlite-*"],
  },
};

export default nextConfig;
