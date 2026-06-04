import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Map Templates — Start from a GIS Template',
  description: 'Get started quickly with ready-made GIS map templates. WKT, GeoJSON, and spatial data templates for common use cases: countries, cities, regions, and more.',
  openGraph: {
    title: 'Map Templates — WKT Studio',
    description: 'Ready-made GIS map templates to start your spatial data project quickly.',
  },
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
