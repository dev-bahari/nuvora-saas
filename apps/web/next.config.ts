import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nuvora/contracts'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
