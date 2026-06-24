import type { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';

// Regenerate hourly so new public projects show up without a rebuild
export const revalidate = 3600;

const MAX_PROJECT_URLS = 1000;

async function getPublicProjectEntries(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection('projects')
      .where('isPublic', '==', true)
      .orderBy('updatedAt', 'desc')
      .limit(MAX_PROJECT_URLS)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      const lastModified = data.updatedAt?.toDate?.() ?? new Date();
      return {
        url: `${baseUrl}/p/${doc.id}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      };
    });
  } catch (error) {
    // Never break the sitemap — fall back to static routes only
    console.error('sitemap: failed to fetch public projects', error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Always use the production domain — NEXT_PUBLIC_APP_URL may be the Vercel preview URL
  const url = 'https://wktstudio.com';

  const staticRoutes: MetadataRoute.Sitemap = [
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

  const projectRoutes = await getPublicProjectEntries(url);

  return [...staticRoutes, ...projectRoutes];
}
