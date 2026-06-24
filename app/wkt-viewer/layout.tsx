import type { Metadata } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wktstudio.com';

export const metadata: Metadata = {
  title: 'WKT Viewer — Free Online WKT Map Visualizer',
  description: 'Free online WKT viewer. Paste WKT geometry from PostGIS or Shapely and visualize POLYGON, LINESTRING, POINT, MULTIPOLYGON and all WKT types on an interactive map. Import CSV, GeoJSON and Shapefiles. No signup required.',
  keywords: ['WKT viewer', 'WKT map', 'visualize WKT', 'WKT to map', 'PostGIS viewer', 'GeoJSON viewer', 'plot WKT online', 'WKT geometry viewer'],
  alternates: { canonical: `${APP_URL}/wkt-viewer` },
  openGraph: {
    title: 'WKT Viewer — Visualize WKT Geometry on a Map',
    description: 'Paste WKT geometry and see it on a map instantly. Supports POLYGON, LINESTRING, POINT, MULTIPOLYGON and all WKT types. Free, no signup.',
    url: `${APP_URL}/wkt-viewer`,
    type: 'website',
    siteName: 'WKT Studio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WKT Viewer — Visualize WKT Geometry on a Map',
    description: 'Paste WKT geometry and see it on a map instantly. Free, no signup.',
  },
};

const FAQ = [
  {
    q: 'What is a WKT viewer?',
    a: 'A WKT viewer renders Well-Known Text geometry on an interactive map. Paste a POINT, LINESTRING, POLYGON or any WKT geometry and it is drawn instantly — no installation or GIS software needed.',
  },
  {
    q: 'Which geometry types are supported?',
    a: 'POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON and GEOMETRYCOLLECTION, including geometries exported from PostGIS, Shapely, GDAL and other OGC-compliant tools.',
  },
  {
    q: 'Can I import CSV, GeoJSON or Shapefiles?',
    a: 'Yes. Besides pasting WKT, you can import CSV files (with a WKT column or lat/lng columns), GeoJSON files and Shapefiles (.shp), and they are plotted on the map automatically.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. The WKT viewer works without signing up. Create a free account only if you want to save your map, share a public link, or keep more than the demo limit of features.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'WKT Viewer',
      url: `${APP_URL}/wkt-viewer`,
      description: 'Free online WKT viewer to visualize Well-Known Text geometry on an interactive map.',
      applicationCategory: 'Utility',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ],
};

export default function WktViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
