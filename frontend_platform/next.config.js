const path = require('path')

const backend = process.env.BACKEND_URL || 'http://localhost:8000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '..'),
    // ponytail: reflect can exceed 30s; Next default proxy timeout is 30_000ms
    proxyTimeout: 180_000,
  },
  webpack: (config) => {
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      ...(config.resolve.modules || []),
    ]
    return config
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }]
  },
}

module.exports = nextConfig
