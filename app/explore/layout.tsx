import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore Public Maps — GeoJSON & WKT Projects',
  description: 'Browse public GIS maps created with WKT Studio. Explore GeoJSON projects, spatial data visualizations, and WKT geometry maps shared by the community.',
  openGraph: {
    title: 'Explore Public Maps — WKT Studio',
    description: 'Discover public GIS projects and spatial data maps created with WKT Studio.',
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
