import type { NextConfig } from 'next'

const isIndexable = process.env.NEXT_PUBLIC_SITE_INDEXABLE === 'true'

const nextConfig: NextConfig = {
  async headers() {
    if (isIndexable) return []

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
        ],
      },
    ]
  },
  allowedDevOrigins: ['192.168.45.220'],
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
}

export default nextConfig
