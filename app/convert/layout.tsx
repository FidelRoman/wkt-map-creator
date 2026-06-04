import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WKT to GeoJSON Converter — WKT, GeoJSON & WKB',
  description: 'Free online converter between WKT, GeoJSON, and WKB formats. Convert PostGIS WKT to GeoJSON, GeoJSON to WKT, and more. Instant preview on map.',
  openGraph: {
    title: 'WKT to GeoJSON Converter — WKT Studio',
    description: 'Convert between WKT, GeoJSON, and WKB instantly. Supports all geometry types: POLYGON, LINESTRING, POINT, MULTIPOLYGON.',
  },
};

export default function ConvertLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
