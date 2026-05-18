export type PlanId = 'free' | 'pro' | 'business';
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
  apiRateLimitPerDay: number | null;
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
    apiRateLimitPerDay: null,
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
    apiRateLimitPerDay: 1000,
  },
  business: {
    maxProjects: null,
    maxLayersPerProject: null,
    maxFeaturesPerLayer: null,
    maxCollaborators: null,
    hasApiAccess: true,
    hasKmlExport: true,
    hasVersionHistory: true,
    hasSpatialAnalysis: true,
    hasStyleRules: true,
    hasEmbedWidget: true,
    hasWebhooks: true,
    hasTeamWorkspaces: true,
    hasWhiteLabel: true,
    apiRateLimitPerDay: 10000,
  },
};

export const PLANS: PlanInfo[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Comienza a explorar',
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: PLAN_LIMITS.free,
    color: '#6b7280',
    features: [
      '3 proyectos',
      '2 capas por proyecto',
      '10 features por capa',
      'Link público de solo lectura',
      'Importar/exportar CSV',
      'Operaciones WKT (unión, diferencia)',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Para profesionales GIS',
    monthlyPrice: 12,
    yearlyPrice: 99,
    limits: PLAN_LIMITS.pro,
    color: '#6366f1',
    features: [
      'Proyectos ilimitados',
      '20 capas por proyecto',
      '5,000 features por capa',
      '5 colaboradores por proyecto',
      'Attribute Table visual',
      'API REST por proyecto',
      'Export KML',
      'Historial de versiones (20 snapshots)',
      'Herramientas espaciales: Buffer',
      'Embed iframe en tu sitio web',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Para equipos y empresas',
    monthlyPrice: 39,
    yearlyPrice: 299,
    limits: PLAN_LIMITS.business,
    color: '#f59e0b',
    features: [
      'Todo lo de Pro',
      'Capas y features ilimitadas',
      'Colaboradores ilimitados',
      'API con 10,000 calls/día',
      'Embed sin watermark (white-label)',
      'Webhooks',
      'Team Workspaces',
      'Snapshots ilimitados',
      'Soporte prioritario',
    ],
  },
];

// Lemon Squeezy variant IDs — configurar en .env.local
export const LS_VARIANTS = {
  pro_monthly: process.env.NEXT_PUBLIC_LS_VARIANT_PRO_MONTHLY ?? '',
  pro_yearly: process.env.NEXT_PUBLIC_LS_VARIANT_PRO_YEARLY ?? '',
  business_monthly: process.env.NEXT_PUBLIC_LS_VARIANT_BUSINESS_MONTHLY ?? '',
  business_yearly: process.env.NEXT_PUBLIC_LS_VARIANT_BUSINESS_YEARLY ?? '',
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

  const upgradeRequired: PlanId = plan === 'free' ? 'pro' : 'business';
  return { allowed: false, limit, current: currentValue, upgradeRequired };
}

export function hasFeature(plan: PlanId, featureKey: FeatureKey): boolean {
  return PLAN_LIMITS[plan][featureKey] as boolean;
}

export const LIMIT_LABELS: Record<LimitKey, string> = {
  maxProjects: 'proyectos',
  maxLayersPerProject: 'capas en este proyecto',
  maxFeaturesPerLayer: 'features en esta capa',
  maxCollaborators: 'colaboradores',
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  hasApiAccess: 'API REST',
  hasKmlExport: 'exportar KML',
  hasVersionHistory: 'historial de versiones',
  hasSpatialAnalysis: 'herramientas de análisis espacial',
  hasStyleRules: 'reglas de estilo condicional',
  hasEmbedWidget: 'embed en tu sitio web',
  hasWebhooks: 'webhooks',
  hasTeamWorkspaces: 'team workspaces',
  hasWhiteLabel: 'white-label sin watermark',
};
