export type PlanId = 'free' | 'pro';
export type BillingInterval = 'month' | 'year';

export interface PlanLimits {
  maxProjects: number | null;
  maxLayersPerProject: number | null;
  maxFeaturesPerLayer: number | null;
  maxCollaborators: number | null;
  hasApiAccess: boolean;
  hasKmlExport: boolean;
  hasVersionHistory: boolean;
  hasSpatialAnalysis: boolean;
  hasStyleRules: boolean;
  hasEmbedWidget: boolean;
  hasWebhooks: boolean;
  hasTeamWorkspaces: boolean;
  hasWhiteLabel: boolean;
  apiRateLimitPerMonth: number | null;
}

export interface PlanInfo {
  id: PlanId;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  limits: PlanLimits;
  features: string[];
  color: string;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxProjects: 3,
    maxLayersPerProject: 2,
    maxFeaturesPerLayer: 10,
    maxCollaborators: 0,
    hasApiAccess: false,
    hasKmlExport: false,
    hasVersionHistory: false,
    hasSpatialAnalysis: false,
    hasStyleRules: false,
    hasEmbedWidget: false,
    hasWebhooks: false,
    hasTeamWorkspaces: false,
    hasWhiteLabel: false,
    apiRateLimitPerMonth: null,
  },
  pro: {
    maxProjects: null,
    maxLayersPerProject: 20,
    maxFeaturesPerLayer: 5000,
    maxCollaborators: 5,
    hasApiAccess: true,
    hasKmlExport: true,
    hasVersionHistory: true,
    hasSpatialAnalysis: true,
    hasStyleRules: true,
    hasEmbedWidget: true,
    hasWebhooks: false,
    hasTeamWorkspaces: false,
    hasWhiteLabel: false,
    apiRateLimitPerMonth: 1000,
  },
};

export const PLANS: PlanInfo[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Start exploring',
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: PLAN_LIMITS.free,
    color: '#6b7280',
    features: [
      '3 projects',
      '2 layers per project',
      '10 features per layer',
      'Public read-only link',
      'Import / export CSV',
      'WKT paste & visualize',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For GIS professionals',
    monthlyPrice: 10,
    yearlyPrice: 99,
    limits: PLAN_LIMITS.pro,
    color: '#6366f1',
    features: [
      'Unlimited projects',
      '20 layers per project',
      '5,000 features per layer',
      '5 collaborators per project',
      'Visual Attribute Table',
      'REST API per project (1,000 calls/month)',
      'KML export',
      'Version history (20 snapshots)',
      'Spatial analysis: Buffer, Union',
      'Embed iframe on your website',
    ],
  },
];

export const PADDLE_PRICES = {
  pro_monthly: process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID ?? '',
  pro_yearly: process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID ?? '',
};

export type LimitKey = keyof Pick<
  PlanLimits,
  'maxProjects' | 'maxLayersPerProject' | 'maxFeaturesPerLayer' | 'maxCollaborators'
>;

export type FeatureKey = keyof Pick<
  PlanLimits,
  | 'hasApiAccess'
  | 'hasKmlExport'
  | 'hasVersionHistory'
  | 'hasSpatialAnalysis'
  | 'hasStyleRules'
  | 'hasEmbedWidget'
  | 'hasWebhooks'
  | 'hasTeamWorkspaces'
  | 'hasWhiteLabel'
>;

export interface LimitCheckResult {
  allowed: boolean;
  limit: number | null;
  current: number;
  upgradeRequired: PlanId | null;
}

export function checkLimit(
  plan: PlanId,
  limitKey: LimitKey,
  currentValue: number
): LimitCheckResult {
  const limits = PLAN_LIMITS[plan];
  const limit = limits[limitKey] as number | null;

  if (limit === null) {
    return { allowed: true, limit: null, current: currentValue, upgradeRequired: null };
  }

  if (currentValue < limit) {
    return { allowed: true, limit, current: currentValue, upgradeRequired: null };
  }

  return { allowed: false, limit, current: currentValue, upgradeRequired: 'pro' };
}

export function hasFeature(plan: PlanId, featureKey: FeatureKey): boolean {
  return PLAN_LIMITS[plan][featureKey] as boolean;
}

export const LIMIT_LABELS: Record<LimitKey, string> = {
  maxProjects: 'projects',
  maxLayersPerProject: 'layers in this project',
  maxFeaturesPerLayer: 'features in this layer',
  maxCollaborators: 'collaborators',
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  hasApiAccess: 'REST API',
  hasKmlExport: 'KML export',
  hasVersionHistory: 'version history',
  hasSpatialAnalysis: 'spatial analysis tools',
  hasStyleRules: 'conditional style rules',
  hasEmbedWidget: 'embed on your website',
  hasWebhooks: 'webhooks',
  hasTeamWorkspaces: 'team workspaces',
  hasWhiteLabel: 'white-label embed',
};
