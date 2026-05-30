import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Mapbox static API (project thumbnails)
      { protocol: "https", hostname: "api.mapbox.com" },
      // Google / Firebase profile pictures
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      // Firebase Storage
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      // Placeholder fallback for missing avatars
      { protocol: "https", hostname: "via.placeholder.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
