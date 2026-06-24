import type { Metadata } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wktstudio.com';

export const metadata: Metadata = {
  title: 'WKT Converter — WKT to GeoJSON, GeoJSON to WKT, WKB',
  description: 'Free online WKT converter. Convert WKT to GeoJSON, GeoJSON to WKT, WKT to WKB and more. Supports PostGIS WKT, Shapely, and all standard geometry types. Instant results.',
  alternates: { canonical: `${APP_URL}/wkt-converter` },
  openGraph: {
    title: 'WKT Converter — WKT to GeoJSON & More',
    description: 'Convert WKT to GeoJSON, GeoJSON to WKT, WKT to WKB instantly. Supports POLYGON, LINESTRING, POINT, MULTIPOLYGON and all WKT types.',
  },
};

// Mirrors the visible FAQ in page.tsx so the structured data stays truthful
const FAQ = [
  {
    q: 'What is WKT (Well-Known Text)?',
    a: 'WKT is a text markup language for representing vector geometry objects. It is used in PostGIS (PostgreSQL), Shapely (Python), GDAL, and most GIS tools. Examples: POINT(lng lat), POLYGON((x1 y1, x2 y2, ...)).',
  },
  {
    q: 'What is the difference between WKT and GeoJSON?',
    a: 'WKT is a compact text format common in databases (PostGIS). GeoJSON is a JSON-based format used in web mapping (Leaflet, Mapbox, D3). Both represent the same geometries — this tool converts between them instantly.',
  },
  {
    q: 'What is WKB (Well-Known Binary)?',
    a: 'WKB is the binary equivalent of WKT, typically stored as a hex string. PostGIS returns WKB by default (e.g., 0101000000...). Use ST_AsText() to get WKT, or paste the hex here to convert.',
  },
  {
    q: 'How to convert PostGIS geometry to GeoJSON?',
    a: 'Run: SELECT ST_AsText(geom) FROM your_table. Paste the result here and select "WKT → GeoJSON". Or use ST_AsGeoJSON(geom) directly in PostgreSQL.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'WKT Converter',
      url: `${APP_URL}/wkt-converter`,
      description: 'Free online tool to convert between WKT, GeoJSON and WKB geometry formats.',
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

export default function WktConverterLayout({ children }: { children: React.ReactNode }) {
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
