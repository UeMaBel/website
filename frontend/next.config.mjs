import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {import('next').NextConfig} */
const nextConfig = (phase) => ({
  output: 'standalone',
  async rewrites() {
    if (phase !== PHASE_DEVELOPMENT_SERVER) return [];
    const backend = (process.env.BACKEND_API_URL?.trim() || 'http://127.0.0.1:8000').replace(/\/$/, '');
    return [{ source: '/media/:path*', destination: `${backend}/media/:path*` }];
  },
});

export default nextConfig;
