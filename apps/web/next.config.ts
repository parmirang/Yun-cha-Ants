import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The home directory above this repo holds a stray yarn.lock; without this
  // Next picks it as the workspace root and warns on every start.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
