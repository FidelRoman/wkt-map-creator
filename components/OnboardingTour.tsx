"use client";
/**
 * Driver.js onboarding tour — fires once for new users (hasCompletedOnboarding === false).
 * Marks the tour as done in Firestore after completion or dismissal.
 */
import { useEffect, useRef } from 'react';
import 'driver.js/dist/driver.css';
import { analytics } from '@/lib/analytics';

interface OnboardingTourProps {
  userId: string;
  onComplete: () => void;
}

const STEPS = [
  {
    popover: {
      title: '👋 Welcome to WKT Studio',
      description:
        "Your GIS editor for developers — paste WKT from PostGIS, import GeoJSON, run spatial analysis, and call the REST API. Let's take a 30-second tour.",
    },
  },
  {
    element: '[data-tour="new-project"]',
    popover: {
      title: 'Create a project',
      description:
        'Each project can have multiple layers with thousands of features. Paste WKT directly, import GeoJSON or Shapefiles, or draw on the map.',
      side: 'bottom' as const,
      align: 'end' as const,
    },
  },
  {
    element: '[data-tour="quick-links"]',
    popover: {
      title: 'Tools & resources',
      description:
        'Browse public maps from the community, convert between WKT / GeoJSON / WKB, or start from a real-data template to save time.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="settings-link"]',
    popover: {
      title: 'API keys & integration',
      description:
        'Generate API keys to push features programmatically from PostGIS, Python, R, or any HTTP client. See the API Docs for curl examples.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="plan-badge"]',
    popover: {
      title: 'Free to start, upgrade anytime',
      description:
        'The Free plan gives you 3 projects and 200 features per layer. Upgrade to Pro for unlimited projects, REST API access, version history, and team collaboration.',
      side: 'bottom' as const,
    },
  },
];

export default function OnboardingTour({ userId, onComplete }: OnboardingTourProps) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Small delay so the dashboard DOM is fully rendered
    const timer = setTimeout(() => {
      import('driver.js').then(({ driver }) => {
        let skipped = false;
        let skippedAt = 0;

        const driverObj = driver({
          showProgress: true,
          progressText: '{{current}} of {{total}}',
          nextBtnText: 'Next →',
          prevBtnText: '← Back',
          doneBtnText: 'Get started!',
          popoverClass: 'wkt-tour-popover',
          steps: STEPS,
          onDestroyStarted: () => {
            // Check if user is closing before the last step
            if (!driverObj.isLastStep()) {
              skipped = true;
              skippedAt = driverObj.getActiveIndex() ?? 0;
            }
          },
          onDestroyed: () => {
            if (skipped) {
              analytics.onboardingSkipped(skippedAt);
            } else {
              analytics.onboardingCompleted();
            }
            onComplete();
          },
        });

        driverObj.drive();
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [userId, onComplete]);

  return null;
}
