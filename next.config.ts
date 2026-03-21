import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

// .env.local'dan key'leri oku (shell env override sorununu aşmak için)
function loadEnvFile(): Record<string, string> {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) vars[match[1].trim()] = match[2].trim();
    }
    return vars;
  } catch {
    return {};
  }
}

const envVars = loadEnvFile();

const nextConfig: NextConfig = {
  env: {
    ANTHROPIC_API_KEY: envVars.ANTHROPIC_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: envVars.SUPABASE_SERVICE_ROLE_KEY,
  },
};

export default nextConfig;
