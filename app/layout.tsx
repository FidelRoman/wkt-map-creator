import type { Metadata } from 'next';
import './globals.css';
import PostHogProvider from '@/components/PostHogProvider';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wktstudio.com';

export const metadata: Metadata = {
  title: {
    default: 'WKT Studio — GIS Map Editor & WKT Viewer',
    template: '%s | WKT Studio',
  },
  description: 'WKT Studio is a full-featured GIS map editor for developers. Paste WKT from PostGIS, import GeoJSON & Shapefiles, run spatial analysis, export PostGIS SQL, and collaborate with your team.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: 'WKT Studio — GIS Map Editor, WKT Viewer & Spatial API',
    description: 'Paste WKT from PostGIS or Shapely, import GeoJSON/Shapefile, visualize on a map, export SQL, and share with your team. Free plan available.',
    url: APP_URL,
    siteName: 'WKT Studio',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WKT Studio — GIS Map Editor & WKT Viewer',
    description: 'The GIS map editor built for developers. WKT paste, GeoJSON/Shapefile import, PostGIS SQL export, REST API, and team collaboration.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'WKT Studio',
  alternateName: ['WKT Studio', 'WKT Viewer', 'WKT Map Viewer', 'WKT Visualizer', 'WKT Online Viewer'],
  url: APP_URL,
  description: 'WKT Studio is a full-featured GIS map editor for developers. Paste WKT from PostGIS, import GeoJSON & Shapefiles, run spatial analysis, export PostGIS SQL, call the REST API, and collaborate with your team.',
  applicationCategory: 'GIS Application',
  operatingSystem: 'Any',
  inLanguage: ['en'],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  featureList: [
    'WKT viewer and visualizer',
    'POLYGON, MULTIPOLYGON, LINESTRING, POINT, GEOMETRYCOLLECTION support',
    'PostGIS WKT viewer',
    'Shapely geometry viewer',
    'GDAL WKT support',
    'Import GeoJSON files',
    'Import Shapefile (.shp)',
    'Import CSV with WKT column',
    'Import CSV with lat/lng columns',
    'Export to CSV',
    'Export to KML',
    'Export to GeoJSON',
    'Export PostGIS SQL INSERT statements',
    'Layer style editor (fill, stroke, opacity)',
    'REST API per project (GET, POST, DELETE)',
    'API key management',
    'Real-time feature comments',
    'Team collaboration (editor/viewer roles)',
    'Public map gallery',
    'Project fork',
    'Map templates',
    'WKT / GeoJSON / WKB converter',
    'Embeddable iframe maps',
    'Attribute table',
    'Spatial analysis: Buffer, Union, Subtract',
    '10 basemap options',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
