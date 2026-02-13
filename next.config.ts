import type { NextConfig } from "next";
import { execSync } from "child_process";

let gitHash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";
if (gitHash === "dev") {
  try {
    gitHash = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {}
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_HASH: gitHash,
  },
};

export default nextConfig;
