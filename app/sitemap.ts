import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  // Always use the production domain — NEXT_PUBLIC_APP_URL may be the Vercel preview URL
  const url = 'https://wktstudio.com';
  return [
    { url, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${url}/wkt-viewer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${url}/wkt-converter`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${url}/explore`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${url}/templates`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${url}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${url}/api-docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${url}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${url}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${url}/refund`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];
}
