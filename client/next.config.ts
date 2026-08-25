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
  allowedDevOrigins: ['192.168.45.98', '10.30.75.242', '10.156.42.92', '10.30.66.65', '172.16.1.163', '192.168.45.36'],
}

export default nextConfig
