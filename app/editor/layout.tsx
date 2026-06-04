import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WKT Viewer & Sandbox Editor — Try Free, No Signup',
  description: 'Free online WKT viewer and map editor. Paste WKT geometry from PostGIS or Shapely, visualize on an interactive map, and export to GeoJSON or CSV. No signup required.',
  openGraph: {
    title: 'WKT Viewer & Sandbox Editor — WKT Studio',
    description: 'Paste WKT geometry and see it on a map instantly. Supports POLYGON, LINESTRING, POINT, MULTIPOLYGON and all WKT types.',
  },
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
