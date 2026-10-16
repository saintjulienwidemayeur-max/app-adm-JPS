import type { NextConfig } from "next";
// The customer import uploads a CSV file through a server action (default limit 1 MB).
const config: NextConfig = { experimental: { serverActions: { bodySizeLimit: "10mb" } } };
export default config;
