import type { NextConfig } from "next";
// The customer import uploads a CSV file through a server action (default limit 1 MB).
// Headers on every response: no guessing of file types, no framing of the app by other sites (clickjacking), no full URL sent to other sites.
const headers = async () => [{ source: "/:path*", headers: [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
] }];
const config: NextConfig = { experimental: { serverActions: { bodySizeLimit: "10mb" } }, headers };
export default config;
