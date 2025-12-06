import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WKT Map Creator',
  description: 'Create and edit WKT maps interactively',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

