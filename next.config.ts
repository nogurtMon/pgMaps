import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // better-sqlite3 is a native addon — must not be bundled into the server chunk
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Raise the proxy body limit so large GPKG uploads (multi-GB) reach the API route.
    // Default is 10 MB, which truncates the file and causes "database disk image is malformed".
    proxyClientMaxBodySize: "10gb",
  },
};

export default nextConfig;
