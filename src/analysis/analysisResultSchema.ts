import { z } from 'zod';

export const SeveritySchema = z.enum(['High', 'Medium', 'Low']);

export const CriticalitySchema = z.enum([
  'Critical',
  'Important',
  'Standard',
  'Low',
]);

export const EvidenceStatusSchema = z.enum([
  'Valid',
  'Missing',
  'Expiring',
]);

export const ExposureRegionSchema = z.enum([
  'EU',
  'US',
  'Global',
]);

export const FindingCategorySchema = z.enum([
  'DORA',
  'Data Residency',
  'AI Act',
  'Digital Sovereignty',
  'Operational Resilience',
]);

export const RemediationOwnerSchema = z.enum([
  'Procurement',
  'Risk',
  'Compliance',
  'Security',
  'IT',
  'Legal',
  'Data Protection',
  'Business Owner',
]);

export const RemediationStatusSchema = z.enum([
  'Open',
  'In Progress',
  'Blocked',
  'Completed',
]);

export const FindingTraceSchema = z.object({
  document: z.string().min(1),
  excerpt: z.string().min(1),
  page: z.number().int().positive().optional(),
  chunkId: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export const ExecutiveSummarySchema = z.object({
  title: z.string().min(1),
  narrative: z.string().min(1),
  keyPoints: z.array(z.string().min(1)),
  materialRisks: z.array(z.string().min(1)),
  recommendedFocus: z.array(z.string().min(1)),
});

export const RemediationPlanSchema = z.object({
  id: z.string().min(1),
  findingTitle: z.string().min(1),
  vendor: z.string().min(1),
  category: FindingCategorySchema,
  priority: SeveritySchema,
  owner: RemediationOwnerSchema,
  timeline: z.string().min(1),
  status: RemediationStatusSchema.default('Open'),
  objective: z.string().min(1),
  actions: z.array(z.string().min(1)),
  successCriteria: z.array(z.string().min(1)),
  relatedArticle: z.string().min(1),
  trace: z.array(FindingTraceSchema).default([]),
});

export const ScenarioSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  industry: z.string().min(1),

  documents: z.number().int().nonnegative(),
  vendors: z.number().int().nonnegative(),
  criticalVendors: z.number().int().nonnegative(),

  readinessScore: z.number().min(0).max(100),

  mainRisk: z.string().min(1),
  headlineFinding: z.string().min(1),
  regionExposure: z.string().min(1),
});

export const DocumentItemSchema = z.object({
  name: z.string().min(1),
  size: z.string().optional(),
  type: z.string().min(1),
  icon: z.string().optional(),
});

export const VendorSchema = z.object({
  name: z.string().min(1),
  service: z.string().min(1),

  criticality: CriticalitySchema,
  risk: SeveritySchema,

  score: z.number().min(0).max(100),

  country: z.string().min(1),
  spend: z.string().min(1),

  category: z
    .enum([
      'Cloud',
      'Payments',
      'Identity',
      'Data',
      'SaaS',
      'AI',
      'Monitoring',
    ])
    .optional(),

  exposure: ExposureRegionSchema.optional(),

  dependency: z
    .enum([
      'Critical',
      'High',
      'Medium',
      'Low',
    ])
    .optional(),

  dataType: z.string().optional(),
  trace: z.array(FindingTraceSchema).default([]),
});

export const FindingSchema = z.object({
  title: z.string().min(1),
  severity: SeveritySchema,
  vendor: z.string().min(1),
  rec: z.string().min(1),
  article: z.string().min(1),
  category: FindingCategorySchema,
  trace: z.array(FindingTraceSchema).default([]),
});

export const EvidenceItemSchema = z.object({
  name: z.string().min(1),
  vendor: z.string().min(1),
  type: z.string().min(1),
  status: EvidenceStatusSchema,
  expires: z.string().min(1),
  trace: z.array(FindingTraceSchema).default([]),
});

export const CloudRiskSchema = z.object({
  label: z.string().min(1),
  pct: z.number().min(0).max(100),
  spend: z.string().min(1),
});

export const SovereigntyScoresSchema = z.object({
  cloud: z.number().min(0).max(100),
  data: z.number().min(0).max(100),
  ai: z.number().min(0).max(100),
  concentration: z.number().min(0).max(100),
  regulatory: z.number().min(0).max(100),
});

export const DependencyItemSchema = z.object({
  vendor: z.string().min(1),
  service: z.string().min(1),
  impact: z.string().min(1),
  icon: z.enum(['cloud', 'payments', 'identity', 'data']),
});

export const OutageSimulationSchema = z.object({
  provider: z.string().min(1),
  affectedDependencies: z.number().int().nonnegative(),
  affectedServices: z.array(z.string().min(1)),
  impact: z.enum(['Medium', 'High', 'Severe']),
  recovery: z.string().min(1),
  recommendation: z.string().min(1),
});

export const AuditItemSchema = z.object({
  label: z.string().min(1),
  pages: z.number().int().nonnegative(),
  type: z.string().min(1),
});

export const AnalysisResultSchema = z.object({
  source: z.enum(['sample', 'upload']),
  generatedAt: z.string().min(1),

  scenario: ScenarioSummarySchema,
  executiveSummary: ExecutiveSummarySchema,

  documents: z.array(DocumentItemSchema),
  vendors: z.array(VendorSchema),
  gaps: z.array(FindingSchema),
  evidence: z.array(EvidenceItemSchema),
  cloudRisk: z.array(CloudRiskSchema),

  sovereigntyScores: SovereigntyScoresSchema,
  dependencies: z.array(DependencyItemSchema),
  outageSimulation: OutageSimulationSchema,

  remediationPlans: z.array(RemediationPlanSchema),

  boardRisks: z.array(z.string().min(1)),
  auditItems: z.array(AuditItemSchema),
  auditRecommendations: z.array(z.string().min(1)),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type Criticality = z.infer<typeof CriticalitySchema>;
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;
export type ExposureRegion = z.infer<typeof ExposureRegionSchema>;
export type FindingCategory = z.infer<typeof FindingCategorySchema>;
export type RemediationOwner = z.infer<typeof RemediationOwnerSchema>;
export type RemediationStatus = z.infer<typeof RemediationStatusSchema>;
export type FindingTrace = z.infer<typeof FindingTraceSchema>;
export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
export type RemediationPlan = z.infer<typeof RemediationPlanSchema>;
export type ScenarioSummary = z.infer<typeof ScenarioSummarySchema>;
export type DocumentItem = z.infer<typeof DocumentItemSchema>;
export type Vendor = z.infer<typeof VendorSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type CloudRisk = z.infer<typeof CloudRiskSchema>;
export type SovereigntyScores = z.infer<typeof SovereigntyScoresSchema>;
export type DependencyItem = z.infer<typeof DependencyItemSchema>;
export type OutageSimulation = z.infer<typeof OutageSimulationSchema>;
export type AuditItem = z.infer<typeof AuditItemSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export function parseAnalysisResult(input: unknown): AnalysisResult {
  return AnalysisResultSchema.parse(input);
}

export function safeParseAnalysisResult(input: unknown) {
  return AnalysisResultSchema.safeParse(input);
}
