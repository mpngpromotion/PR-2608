import type { MetadataRoute } from 'next'
import { APP_INFO } from '@/config'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: '', priority: 1 },
    { path: '/album', priority: 0.8 },
    { path: '/gallery', priority: 0.8 },
    { path: '/lyrics', priority: 0.8 },
    { path: '/mood-film', priority: 0.8 },
  ] as const

  return routes.map(({ path, priority }) => ({
    url: `${APP_INFO.url}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority,
  }))
}
