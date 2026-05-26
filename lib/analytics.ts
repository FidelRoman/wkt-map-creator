/**
 * Thin wrapper around PostHog so the rest of the app never imports posthog-js directly.
 * All calls are no-ops when NEXT_PUBLIC_POSTHOG_KEY is not set (dev / CI).
 */

type Properties = Record<string, string | number | boolean | null | undefined>;

function getPostHog() {
  if (typeof window === 'undefined') return null;
  // posthog-js attaches itself to window after init
  return (window as any).__posthog__ ?? null;
}

export function capture(event: string, properties?: Properties) {
  try {
    const ph = getPostHog();
    ph?.capture(event, properties);
  } catch {
    // Never throw from analytics
  }
}

export function identify(userId: string, properties?: Properties) {
  try {
    const ph = getPostHog();
    ph?.identify(userId, properties);
  } catch {}
}

export function reset() {
  try {
    const ph = getPostHog();
    ph?.reset();
  } catch {}
}

// ─── Typed event helpers ──────────────────────────────────────────────────────

export const analytics = {
  signUp: () => capture('sign_up'),
  signIn: (plan: string) => capture('sign_in', { plan }),
  signOut: () => { capture('sign_out'); reset(); },

  projectCreated: (name: string) => capture('project_created', { name }),
  projectDeleted: () => capture('project_deleted'),
  projectForked: () => capture('project_forked'),

  featureAdded: (method: 'draw' | 'wkt_paste' | 'import') => capture('feature_added', { method }),
  layerCreated: () => capture('layer_created'),

  importStarted: (format: string) => capture('import_started', { format }),
  exportStarted: (format: string) => capture('export_started', { format }),

  upgradeModalOpened: (trigger: string) => capture('upgrade_modal_opened', { trigger }),
  upgradeCompleted: (plan: string, interval: string) => capture('upgrade_completed', { plan, interval }),

  snapshotCreated: () => capture('snapshot_created'),
  snapshotRestored: () => capture('snapshot_restored'),

  apiKeyGenerated: () => capture('api_key_generated'),
  embedCodeCopied: () => capture('embed_code_copied'),

  onboardingCompleted: () => capture('onboarding_completed'),
  onboardingSkipped: (step: number) => capture('onboarding_skipped', { step }),
};
