import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wktmap.com';
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/editor'] },
    sitemap: `${url}/sitemap.xml`,
  };
}
