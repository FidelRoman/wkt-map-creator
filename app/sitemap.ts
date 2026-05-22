import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wktstudio.com';
  return [
    { url, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${url}/convert`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${url}/explore`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${url}/templates`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${url}/api-docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${url}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${url}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${url}/refund`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];
}
