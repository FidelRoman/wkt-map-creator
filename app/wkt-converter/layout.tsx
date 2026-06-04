import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WKT Converter — WKT to GeoJSON, GeoJSON to WKT, WKB',
  description: 'Free online WKT converter. Convert WKT to GeoJSON, GeoJSON to WKT, WKT to WKB and more. Supports PostGIS WKT, Shapely, and all standard geometry types. Instant results.',
  openGraph: {
    title: 'WKT Converter — WKT to GeoJSON & More',
    description: 'Convert WKT to GeoJSON, GeoJSON to WKT, WKT to WKB instantly. Supports POLYGON, LINESTRING, POINT, MULTIPOLYGON and all WKT types.',
  },
};

export default function WktConverterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
