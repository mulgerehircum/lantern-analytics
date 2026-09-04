/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-hosted flag PNGs never change content per code (see
  // src/components/CountryLabel.tsx) - a 1-year immutable header means the
  // browser fetches each flag exactly once, ever. The long list of codes is
  // deliberate: Vercel's CDN respects long cache headers for files in
  // /public, and every code only appears in the list it was fetched for.
  async headers() {
    return [
      {
        source: "/flags/:code.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
