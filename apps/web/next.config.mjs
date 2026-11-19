/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@artoholic/shared'],
  experimental: { instrumentationHook: true, serverComponentsExternalPackages: ['bcrypt', 'pg-boss'] },
  poweredByHeader: false
};
export default nextConfig;
