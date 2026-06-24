import type { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wktstudio.com';

interface Props {
  params: Promise<{ projectId: string }>;
  children: React.ReactNode;
}

async function getProject(projectId: string) {
  try {
    const db = getAdminDb();
    const doc = await db.collection('projects').doc(projectId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as any;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    return {
      title: 'Map Project',
      robots: { index: false, follow: false },
    };
  }

  if (!project.isPublic) {
    return {
      title: project.name ?? 'Map Project',
      robots: { index: false, follow: false },
    };
  }

  const title = project.name ?? 'Untitled Map';
  const featureCount: number = project.featureCount ?? 0;
  const description = `Interactive map with ${featureCount} feature${featureCount !== 1 ? 's' : ''}. Created with WKT Studio — the GIS map editor for developers.`;
  const url = `${APP_URL}/p/${projectId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'WKT Studio',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function ProjectLayout({ params, children }: Props) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  const jsonLd = project?.isPublic
    ? {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: project.name ?? 'Untitled Map',
        description: `Spatial dataset with ${project.featureCount ?? 0} features, created with WKT Studio.`,
        url: `${APP_URL}/p/${projectId}`,
        creator: {
          '@type': 'Person',
          name: project.ownerName ?? 'WKT Studio User',
        },
        dateModified: project.updatedAt?.toDate
          ? project.updatedAt.toDate().toISOString()
          : undefined,
        keywords: ['GIS', 'WKT', 'GeoJSON', 'spatial data', 'map'],
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
