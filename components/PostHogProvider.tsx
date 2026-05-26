"use client";
/**
 * Initializes PostHog on the client and exposes the instance as window.__posthog__
 * so lib/analytics.ts can reference it without a direct import cycle.
 * Safe no-op when NEXT_PUBLIC_POSTHOG_KEY is unset (dev / CI).
 */
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    __posthog__?: any;
  }
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.__posthog__) {
      window.__posthog__.capture('$pageview', {
        $current_url: window.location.href,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === 'undefined') return;

    import('posthog-js').then(({ default: posthog }) => {
      if (!(posthog as any).__loaded) {
        posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
          capture_pageview: false, // we fire manually via PageviewTracker
          persistence: 'localStorage',
        });
      }
      window.__posthog__ = posthog;
    });
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
