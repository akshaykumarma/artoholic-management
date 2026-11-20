import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// The one .env lives at the repository root (scripts read it too). Next.js only looks in apps/web,
// so load the root file here. Values already set in the environment (Docker, CI) win.
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@artoholic/shared'],
  experimental: { instrumentationHook: true, serverComponentsExternalPackages: ['bcrypt', 'pg-boss'] },
  poweredByHeader: false
};
export default nextConfig;
