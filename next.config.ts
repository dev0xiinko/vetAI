import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal server + only the deps it traces.
  output: "standalone",
};

export default nextConfig;
