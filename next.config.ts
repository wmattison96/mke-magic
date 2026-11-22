import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // LAN-only hostname for iPhone Safari development; production auth is unchanged.
  allowedDevOrigins: ["192.168.1.216"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cards.scryfall.io", pathname: "/**" }],
  },
};

export default nextConfig;
