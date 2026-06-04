import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WKT Viewer — Free Online WKT Map Visualizer',
  description: 'Free online WKT viewer. Paste WKT geometry from PostGIS or Shapely, visualize POLYGON, LINESTRING, POINT and all WKT types on an interactive map. No signup required.',
  openGraph: {
    title: 'WKT Viewer — Visualize WKT Geometry on a Map',
    description: 'Paste WKT geometry and see it on a map instantly. Supports POLYGON, LINESTRING, POINT, MULTIPOLYGON and all WKT types. Free, no signup.',
  },
};

export default function WktViewerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
