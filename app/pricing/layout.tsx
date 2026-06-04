import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Free & Pro Plans',
  description: 'WKT Studio is free forever with generous limits. Upgrade to Pro for unlimited features, layers, REST API access, KML export, and team collaboration.',
  openGraph: {
    title: 'WKT Studio Pricing — Free & Pro Plans',
    description: 'Free plan: 3 projects, 10 features/layer. Pro plan: unlimited projects and features, REST API, KML export, version history, and more.',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
