import type { Metadata } from 'next';
import './globals.css';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wktmap.com';

export const metadata: Metadata = {
  title: {
    default: 'WKT Viewer Online — Free WKT Map Viewer & Editor',
    template: '%s | WKT Map Creator',
  },
  description: 'Free online WKT viewer. Paste WKT geometry from PostGIS, Shapely or GDAL and visualize POLYGON, MULTIPOLYGON and LINESTRING on an interactive map instantly. Export to CSV or KML.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: 'WKT Viewer Online — Free WKT Map Viewer & Editor',
    description: 'Paste WKT from PostGIS or Shapely, visualize on a map in seconds, share with a link. Free.',
    url: APP_URL,
    siteName: 'WKT Map Creator',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WKT Viewer Online — Free WKT Map Viewer',
    description: 'Paste WKT geometry from PostGIS or Shapely and see it on a map instantly. Free WKT viewer online.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'WKT Map Creator',
  alternateName: ['WKT Viewer', 'WKT Map Viewer', 'WKT Visualizer', 'WKT Online Viewer'],
  url: APP_URL,
  description: 'Free online WKT viewer and editor. Paste WKT geometry from PostGIS, Shapely or any GIS tool and visualize it on an interactive map instantly. Export to CSV or KML.',
  applicationCategory: 'GIS Application',
  operatingSystem: 'Any',
  inLanguage: ['en', 'es'],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  featureList: [
    'WKT viewer and visualizer',
    'POLYGON viewer',
    'MULTIPOLYGON viewer',
    'LINESTRING viewer',
    'PostGIS WKT viewer',
    'Shapely geometry viewer',
    'GDAL WKT support',
    'Export WKT to CSV',
    'Export WKT to KML',
    'WKT to GeoJSON',
    'REST API per project',
    'Collaborative map editing',
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
      <body>{children}</body>
    </html>
  );
}
